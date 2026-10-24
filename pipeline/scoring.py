"""Pure numpy scoring functions for the Landsat data pipeline.

No file I/O and no network access. Every function leaves its input arrays
unchanged (Requirement 4.1): inputs are read through ``np.asarray`` and only
non-mutating operations or fresh copies are used.

Landsat Collection 2 Level-2 scale factors (USGS):
- Surface temperature (ST_B10 / ``lwir11``): K = DN * 0.00341802 + 149.0
- Surface reflectance (SR_B4 / SR_B5):       rho = DN * 0.0000275 - 0.2
DN 0 is fill in every band.
"""

from __future__ import annotations

import numpy as np

from config import MIN_VALID_FRAC

# QA_PIXEL bits treated as bad: 0 fill, 1 dilated cloud, 3 cloud,
# 4 cloud shadow, 7 water. Cirrus (2) and snow (5) are not masked.
QA_BAD_BITS = 0b10011011

# Collection 2 Level-2 scale factors.
_ST_SCALE = 0.00341802
_ST_OFFSET = 149.0
_SR_SCALE = 0.0000275
_SR_OFFSET = -0.2


def dn_to_fahrenheit(dn: np.ndarray) -> np.ndarray:
    """Surface temperature DN -> degrees Fahrenheit (float64), NaN where DN == 0."""
    raw = np.asarray(dn)
    # Cast to float64 first so uint16 arithmetic cannot overflow.
    d = raw.astype(np.float64)
    kelvin = d * _ST_SCALE + _ST_OFFSET
    fahrenheit = (kelvin - 273.15) * 9.0 / 5.0 + 32.0
    return np.where(raw == 0, np.nan, fahrenheit)


def dn_to_reflectance(dn: np.ndarray) -> np.ndarray:
    """Surface reflectance DN -> reflectance (float64), NaN where DN == 0."""
    raw = np.asarray(dn)
    d = raw.astype(np.float64)
    return np.where(raw == 0, np.nan, d * _SR_SCALE + _SR_OFFSET)


def ndvi(red: np.ndarray, nir: np.ndarray) -> np.ndarray:
    """NDVI = (nir - red) / (nir + red), clipped to [-1, 1], as float32.

    NaN where ``nir + red == 0`` or either input is NaN. Never raises for
    those cases (Requirements 4.4, 4.5).
    """
    r = np.asarray(red, dtype=np.float64)
    n = np.asarray(nir, dtype=np.float64)
    with np.errstate(divide="ignore", invalid="ignore"):
        total = n + r
        value = (n - r) / total
        undefined = (total == 0) | np.isnan(r) | np.isnan(n)
        value = np.where(undefined, np.nan, value)
        # np.clip passes NaN through; +/-1 are exact in float32.
        value = np.clip(value, -1.0, 1.0)
    return value.astype(np.float32)


def qa_mask(qa: np.ndarray) -> np.ndarray:
    """Bad-pixel mask from QA_PIXEL: True where any of bits 0, 1, 3, 4, 7 is set."""
    return (np.asarray(qa).astype(np.uint16) & QA_BAD_BITS) != 0


def clear_fraction(qa: np.ndarray, inside: np.ndarray) -> float:
    """Share of inside-Boston pixels whose QA is not bad.

    Returns NaN when ``inside`` has no True values, so callers can report
    "no Boston pixels" instead of dividing by zero.
    """
    inside_b = np.asarray(inside, dtype=bool)
    n_inside = int(np.count_nonzero(inside_b))
    if n_inside == 0:
        return float("nan")
    n_clear = int(np.count_nonzero(inside_b & ~qa_mask(qa)))
    return n_clear / n_inside


def median_valid_f(lwir: np.ndarray, qa: np.ndarray, inside: np.ndarray) -> float | None:
    """Median degrees F over Valid_Heat_Pixels, or None if there are none.

    Valid_Heat_Pixel: inside Boston, ``lwir != 0``, and QA not bad.
    """
    lwir_a = np.asarray(lwir)
    valid = np.asarray(inside, dtype=bool) & (lwir_a != 0) & ~qa_mask(qa)
    if not np.any(valid):
        return None
    temps = dn_to_fahrenheit(lwir_a)[valid]
    return float(np.median(temps))


def percentile_rank(values: np.ndarray) -> np.ndarray:
    """0-100 percentile rank of each non-NaN value (float64), NaN elsewhere.

    Vectorized form of ``make_sample_data.percentile_scores``: 0-based ranks,
    tied values share the average rank, score = round(100 * rank / (n - 1))
    with Python's ``round`` (half to even), and 50 for a single value. Empty
    or all-NaN input gives an all-NaN array of the same length.
    """
    arr = np.asarray(values, dtype=np.float64)
    out = np.full(arr.shape, np.nan, dtype=np.float64)
    ok = ~np.isnan(arr)
    v = arr[ok]
    n = v.size
    if n == 0:
        return out
    if n == 1:
        out[ok] = 50.0
        return out

    _, inv, counts = np.unique(v, return_inverse=True, return_counts=True)
    inv = inv.reshape(-1)
    start = np.cumsum(counts) - counts
    # Same value as (i + j) / 2 for a tie group spanning sorted positions i..j.
    avg = start + (counts - 1) / 2.0

    denom = n - 1
    scores = [round(100 * float(avg[k]) / denom) for k in inv]
    out[ok] = np.asarray(scores, dtype=np.float64)
    return out


def apply_min_valid(score, valid_frac: float):
    """Return ``score`` when ``valid_frac >= MIN_VALID_FRAC`` (inclusive), else None."""
    if valid_frac >= MIN_VALID_FRAC:
        return score
    return None
