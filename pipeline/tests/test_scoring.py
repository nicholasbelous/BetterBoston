"""Tests for ``pipeline/scoring.py`` (pure numpy scoring functions).

Property tests use hypothesis with the shared "pipeline" profile from
``conftest.py`` (100 examples, no deadline). Each property test is tagged
with its design-document property number.
"""

import numpy as np
from hypothesis import given
from hypothesis import strategies as st
from hypothesis.extra import numpy as hnp

import scoring

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
