"""Tests for ``pipeline/scoring.py`` (pure numpy scoring functions).

Property tests use hypothesis with the shared "pipeline" profile from
``conftest.py`` (100 examples, no deadline). Each property test is tagged
with its design-document property number.
"""

import math
import warnings

import numpy as np
from hypothesis import given
from hypothesis import strategies as st
from hypothesis.extra import numpy as hnp

import make_sample_data  # stdlib-only imports; main() is __main__-guarded
import scoring
from config import MIN_VALID_FRAC

# ---------------------------------------------------------------------------
# Shared strategies
# ---------------------------------------------------------------------------

# DN values: bias toward 0 (fill) and the uint16 extremes so every run sees them.
_dn_values = st.one_of(
    st.just(0),
    st.sampled_from([1, 65535]),
    st.integers(min_value=0, max_value=65535),
)

# uint16 arrays of any shape (0-D scalars through small 4-D arrays, including empty).
uint16_arrays = hnp.arrays(
    dtype=np.uint16,
    shape=hnp.array_shapes(min_dims=0, max_dims=4, min_side=0, max_side=8),
    elements=_dn_values,
)


# ---------------------------------------------------------------------------
# Property 3: DN conversions
# ---------------------------------------------------------------------------

# Feature: landsat-data-pipeline, Property 3: DN conversions match the Collection 2 formulas
@given(dn=uint16_arrays)
def test_dn_conversions_match_collection2_formulas(dn):
    """**Validates: Requirements 4.2, 4.3**"""
    fahrenheit = scoring.dn_to_fahrenheit(dn)
    reflectance = scoring.dn_to_reflectance(dn)

    fill = dn == 0
    d = dn.astype(np.float64)
    expected_f = ((d * 0.00341802 + 149.0) - 273.15) * 9.0 / 5.0 + 32.0
    expected_r = d * 0.0000275 - 0.2

    for out in (fahrenheit, reflectance):
        assert isinstance(out, np.ndarray)
        assert out.shape == dn.shape
        assert np.issubdtype(out.dtype, np.floating)
        # NaN exactly where DN is 0 (fill).
        np.testing.assert_array_equal(np.isnan(out), fill)

    assert np.all(np.abs(fahrenheit[~fill] - expected_f[~fill]) <= 0.01)
    assert np.all(np.abs(reflectance[~fill] - expected_r[~fill]) <= 1e-6)


# ---------------------------------------------------------------------------
# Property 4: NDVI
# ---------------------------------------------------------------------------

# Reflectance values in the Collection 2 range, plus zeros and NaN.
_reflectance_or_nan = st.one_of(
    st.just(0.0),
    st.just(float("nan")),
    st.floats(min_value=-0.2, max_value=1.61, allow_nan=False),
)

# (red, nir) pairs. Mix independent pairs with pairs that sum to exactly 0
# (red = -x, nir = x with |x| <= 0.2 so both stay in range) and (0, 0).
_red_nir_pairs = st.one_of(
    st.tuples(_reflectance_or_nan, _reflectance_or_nan),
    st.floats(min_value=-0.2, max_value=0.2, allow_nan=False).map(lambda x: (-x, x)),
    st.just((0.0, 0.0)),
)


# Feature: landsat-data-pipeline, Property 4: NDVI is float32, clipped, and NaN where undefined
@given(pairs=st.lists(_red_nir_pairs, min_size=0, max_size=1000))
def test_ndvi_float32_clipped_nan_where_undefined(pairs):
    """**Validates: Requirements 4.4, 4.5, 4.11**"""
    red = np.array([p[0] for p in pairs], dtype=np.float64)
    nir = np.array([p[1] for p in pairs], dtype=np.float64)

    # Any RuntimeWarning (divide by zero, invalid value) becomes an error,
    # so this also checks ndvi never raises or warns on these inputs.
    with warnings.catch_warnings():
        warnings.simplefilter("error")
        out = scoring.ndvi(red, nir)

    assert isinstance(out, np.ndarray)
    assert out.dtype == np.float32
    assert out.shape == red.shape

    with np.errstate(all="ignore"):
        total = nir + red
        undefined = (total == 0) | np.isnan(red) | np.isnan(nir)
        expected = np.clip((nir - red) / total, -1.0, 1.0)

    # NaN exactly where the index is undefined.
    np.testing.assert_array_equal(np.isnan(out), undefined)

    defined = ~undefined
    got = out[defined]
    assert np.all((got >= -1.0) & (got <= 1.0))
    np.testing.assert_allclose(
        got, expected[defined].astype(np.float32), rtol=1e-6, atol=0
    )


# ---------------------------------------------------------------------------
# Property 5: QA mask
# ---------------------------------------------------------------------------

# QA values: each bad bit (0 fill, 1 dilated cloud, 3 cloud, 4 shadow, 7 water)
# alone, each non-masked bit (2 cirrus, 5 snow, 6 clear) alone, every other
# single bit, 0 and 65535, plus arbitrary uint16 values.
_qa_values = st.one_of(
    st.sampled_from([1 << b for b in (0, 1, 3, 4, 7)]),
    st.sampled_from([1 << b for b in (2, 5, 6)]),
    st.integers(min_value=0, max_value=15).map(lambda b: 1 << b),
    st.sampled_from([0, 65535]),
    st.integers(min_value=0, max_value=65535),
)

qa_arrays = hnp.arrays(
    dtype=np.uint16,
    shape=hnp.array_shapes(min_dims=0, max_dims=4, min_side=0, max_side=8),
    elements=_qa_values,
)


# Feature: landsat-data-pipeline, Property 5: QA mask is the bit test
@given(qa=qa_arrays)
def test_qa_mask_is_the_bit_test(qa):
    """**Validates: Requirements 4.6, 4.12**"""
    before = qa.copy()
    out = scoring.qa_mask(qa)

    assert isinstance(out, np.ndarray)
    assert out.dtype == np.bool_
    assert out.shape == qa.shape

    # Literal bit pattern so the test does not depend on scoring.QA_BAD_BITS.
    expected = (qa.astype(np.uint32) & 0b10011011) != 0
    np.testing.assert_array_equal(out, expected)

    # Input left unchanged.
    np.testing.assert_array_equal(qa, before)


# Feature: landsat-data-pipeline, Property 5: QA mask is the bit test
@given(value=_qa_values)
def test_qa_mask_scalar_value(value):
    """**Validates: Requirements 4.6, 4.12**"""
    out = scoring.qa_mask(np.uint16(value))
    assert out.shape == ()
    assert bool(out) == ((value & 0b10011011) != 0)


# ---------------------------------------------------------------------------
# Property 6: percentile_rank vs sample data
# ---------------------------------------------------------------------------

# Tie-heavy value lists: draw from a small pool (lots of exact repeats),
# round to 1 decimal like published degrees F, or use arbitrary finite floats.
_finite = st.floats(allow_nan=False, allow_infinity=False, width=64)
_tie_heavy_lists = st.one_of(
    st.lists(_finite, min_size=1, max_size=5).flatmap(
        lambda pool: st.lists(st.sampled_from(pool), min_size=1, max_size=1000)
    ),
    st.lists(
        st.floats(min_value=60.0, max_value=110.0).map(lambda x: round(x, 1)),
        min_size=1,
        max_size=1000,
    ),
    st.lists(_finite, min_size=1, max_size=1000),
)


# Feature: landsat-data-pipeline, Property 6: percentile_rank matches the sample-data reference
@given(values=_tie_heavy_lists)
def test_percentile_rank_matches_sample_data_reference(values):
    """**Validates: Requirements 4.7, 4.8**"""
    arr = np.array(values, dtype=np.float64)
    before = arr.copy()
    out = scoring.percentile_rank(arr)
    expected = make_sample_data.percentile_scores(list(values))

    assert isinstance(out, np.ndarray)
    assert out.dtype == np.float64
    assert out.shape == arr.shape
    assert not np.any(np.isnan(out))
    assert out.tolist() == [float(e) for e in expected]
    np.testing.assert_array_equal(arr, before)


# Feature: landsat-data-pipeline, Property 6: percentile_rank matches the sample-data reference
@given(value=_finite)
def test_percentile_rank_single_value_is_50(value):
    """**Validates: Requirements 4.7, 4.8**"""
    out = scoring.percentile_rank(np.array([value], dtype=np.float64))
    assert out.tolist() == [50.0]
    assert make_sample_data.percentile_scores([value]) == [50]


# ---------------------------------------------------------------------------
# Property 7: percentile_rank bounds, ties, and monotonicity
# ---------------------------------------------------------------------------


@st.composite
def _tie_heavy_lists_with_nan(draw):
    """Tie-heavy finite lists (length 1-1000) with NaN mixed in at random spots.

    Some lists may end up all-NaN; the property only constrains non-NaN outputs.
    """
    values = draw(_tie_heavy_lists)
    nan_mask = draw(st.lists(st.booleans(), min_size=len(values), max_size=len(values)))
    return [float("nan") if m else v for v, m in zip(values, nan_mask)]


# Feature: landsat-data-pipeline, Property 7: percentile_rank is bounded, tie-consistent, and monotone
@given(values=_tie_heavy_lists_with_nan())
def test_percentile_rank_bounded_tie_consistent_monotone(values):
    """**Validates: Requirements 4.10**"""
    arr = np.array(values, dtype=np.float64)
    out = scoring.percentile_rank(arr)

    assert out.shape == arr.shape

    ok = ~np.isnan(arr)
    x = arr[ok]
    y = out[ok]
    # Every finite input gets a score.
    assert not np.any(np.isnan(y))

    # Bounded whole numbers in [0, 100].
    assert np.all((y >= 0) & (y <= 100))
    np.testing.assert_array_equal(y, np.round(y))

    # Sort by input; ties then sit next to each other, so adjacent checks
    # cover both tie consistency and monotonicity in O(n log n).
    order = np.argsort(x, kind="stable")
    xs = x[order]
    ys = y[order]
    if xs.size > 1:
        dx = np.diff(xs)
        dy = np.diff(ys)
        # Equal inputs -> equal outputs.
        assert np.all(dy[dx == 0] == 0)
        # a < b -> score(a) <= score(b).
        assert np.all(dy[dx > 0] >= 0)


# ---------------------------------------------------------------------------
# Property 8: NaN inputs do not affect percentile_rank
# ---------------------------------------------------------------------------


@st.composite
def _lists_with_nan_at_varied_positions(draw):
    """1-D float lists with NaN mixed in at varied positions.

    Explicitly covers: empty lists, all-NaN lists, a single finite value
    surrounded by many NaNs, and tie-heavy finite values with NaN inserted
    at random indices (start, middle, end, runs).
    """
    kind = draw(st.sampled_from(["empty", "all_nan", "single", "mixed"]))
    if kind == "empty":
        return []
    if kind == "all_nan":
        return [float("nan")] * draw(st.integers(min_value=1, max_value=1000))
    if kind == "single":
        n_nan = draw(st.integers(min_value=0, max_value=999))
        pos = draw(st.integers(min_value=0, max_value=n_nan))
        values = [float("nan")] * n_nan
        values.insert(pos, draw(_finite))
        return values
    # Mixed: finite tie-heavy values with NaNs inserted at random positions.
    # One shrinkable Random draw picks the insert positions, which keeps the
    # Hypothesis data buffer small even for ~1000-element lists.
    values = list(draw(_tie_heavy_lists))
    n_nan = draw(st.integers(min_value=0, max_value=1000 - len(values)))
    rnd = draw(st.randoms(use_true_random=False))
    for _ in range(n_nan):
        values.insert(rnd.randint(0, len(values)), float("nan"))
    return values


# Feature: landsat-data-pipeline, Property 8: NaN inputs do not affect percentile_rank
@given(values=_lists_with_nan_at_varied_positions())
def test_percentile_rank_nan_inputs_do_not_affect_results(values):
    """**Validates: Requirements 4.9, 4.16**"""
    arr = np.array(values, dtype=np.float64)

    # Must not raise (or warn) for empty or all-NaN input.
    with warnings.catch_warnings():
        warnings.simplefilter("error")
        out = scoring.percentile_rank(arr)

    assert isinstance(out, np.ndarray)
    assert out.shape == arr.shape

    nan_in = np.isnan(arr)
    # NaN exactly at the NaN input positions.
    np.testing.assert_array_equal(np.isnan(out), nan_in)

    # Non-NaN outputs equal percentile_rank of the NaN-free array, same order.
    stripped = arr[~nan_in]
    expected = scoring.percentile_rank(stripped)
    assert out[~nan_in].tolist() == expected.tolist()

    # Requirement 4.8: a lone finite value scores 50 however many NaNs surround it.
    if stripped.size == 1:
        assert out[~nan_in].tolist() == [50.0]


# ---------------------------------------------------------------------------
# Property 9: scoring functions do not modify their inputs
# ---------------------------------------------------------------------------


def _assert_unchanged(after, before):
    """Same dtype, same shape, same values, NaN in the same places."""
    assert after.dtype == before.dtype
    assert after.shape == before.shape
    np.testing.assert_array_equal(after, before)


# Shared shape so qa / inside / lwir arrays line up (0-D through small 4-D, incl. empty).
_shapes = hnp.array_shapes(min_dims=0, max_dims=4, min_side=0, max_side=8)

# Float values for ndvi inputs: reflectance range, zeros, and NaN.
_ndvi_floats = st.one_of(
    st.just(0.0),
    st.just(float("nan")),
    # width=32 so values fit float32 arrays exactly; bounds rounded to float32.
    st.floats(
        min_value=float(np.float32(-0.2)),
        max_value=float(np.float32(1.61)),
        allow_nan=False,
        width=32,
    ),
)


@st.composite
def _scoring_inputs(draw):
    """Same-shape inputs for every scoring function that takes arrays."""
    shape = draw(_shapes)
    float_dtype = draw(st.sampled_from([np.float32, np.float64]))
    return {
        "dn": draw(hnp.arrays(np.uint16, shape, elements=_dn_values)),
        "qa": draw(hnp.arrays(np.uint16, shape, elements=_qa_values)),
        "inside": draw(hnp.arrays(np.bool_, shape)),
        "red": draw(hnp.arrays(float_dtype, shape, elements=_ndvi_floats)),
        "nir": draw(hnp.arrays(float_dtype, shape, elements=_ndvi_floats)),
    }


# Feature: landsat-data-pipeline, Property 9: Scoring functions do not modify their inputs
@given(inputs=_scoring_inputs())
def test_scoring_functions_do_not_modify_array_inputs(inputs):
    """**Validates: Requirements 4.1**"""
    before = {k: v.copy() for k, v in inputs.items()}
    dn, qa, inside = inputs["dn"], inputs["qa"], inputs["inside"]
    red, nir = inputs["red"], inputs["nir"]

    scoring.dn_to_fahrenheit(dn)
    _assert_unchanged(dn, before["dn"])

    scoring.dn_to_reflectance(dn)
    _assert_unchanged(dn, before["dn"])

    scoring.ndvi(red, nir)
    _assert_unchanged(red, before["red"])
    _assert_unchanged(nir, before["nir"])

    scoring.qa_mask(qa)
    _assert_unchanged(qa, before["qa"])

    scoring.clear_fraction(qa, inside)
    _assert_unchanged(qa, before["qa"])
    _assert_unchanged(inside, before["inside"])

    # dn doubles as the lwir band here.
    scoring.median_valid_f(dn, qa, inside)
    _assert_unchanged(dn, before["dn"])
    _assert_unchanged(qa, before["qa"])
    _assert_unchanged(inside, before["inside"])


# Feature: landsat-data-pipeline, Property 9: Scoring functions do not modify their inputs
@given(values=_lists_with_nan_at_varied_positions())
def test_percentile_rank_does_not_modify_input(values):
    """**Validates: Requirements 4.1**"""
    arr = np.array(values, dtype=np.float64)
    before = arr.copy()
    scoring.percentile_rank(arr)
    _assert_unchanged(arr, before)


# ---------------------------------------------------------------------------
# Property 10: apply_min_valid uses an inclusive threshold
# ---------------------------------------------------------------------------

# valid_frac in [0, 1]: always cover the boundary (exactly MIN_VALID_FRAC and
# the float just below it) plus the range ends, then arbitrary values.
_valid_fracs = st.one_of(
    st.sampled_from(
        [
            MIN_VALID_FRAC,
            math.nextafter(MIN_VALID_FRAC, 0.0),
            math.nextafter(MIN_VALID_FRAC, 1.0),
            0.0,
            1.0,
        ]
    ),
    st.floats(min_value=0.0, max_value=1.0, allow_nan=False),
)

# Varied score values: None, ints, finite floats, NaN, numpy scalars, and an
# arbitrary object (identity must be preserved, not just equality).
_scores = st.one_of(
    st.none(),
    st.integers(min_value=0, max_value=100),
    st.integers(),
    st.floats(allow_nan=True, allow_infinity=True),
    st.floats(min_value=0.0, max_value=100.0).map(np.float64),
    st.builds(object),
)


# Feature: landsat-data-pipeline, Property 10: apply_min_valid uses an inclusive threshold
@given(score=_scores, valid_frac=_valid_fracs)
def test_apply_min_valid_inclusive_threshold(score, valid_frac):
    """**Validates: Requirements 4.13, 4.15**"""
    out = scoring.apply_min_valid(score, valid_frac)
    if valid_frac >= MIN_VALID_FRAC:
        # Kept unchanged: the very same object comes back.
        assert out is score
    else:
        assert out is None
