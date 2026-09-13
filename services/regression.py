"""
Shared linear regression utilities.

Every kinetic model in this application is reduced to a straight line
Y = m*X + b before anything is reported to the user. This module is the
single place that performs that fit, so every method behaves consistently.
"""

import numpy as np
from scipy import stats


def linear_fit(x, y):
    """
    Fit Y = m*X + b to the given points and return slope, intercept and R^2.

    Returns a dict:
        {"slope": float, "intercept": float, "r_squared": float}

    Raises ValueError if fewer than 2 finite points are supplied, or if the
    fit could not be computed (e.g. all X values identical).
    """
    x = np.asarray(x, dtype=float)
    y = np.asarray(y, dtype=float)

    mask = np.isfinite(x) & np.isfinite(y)
    x, y = x[mask], y[mask]

    if len(x) < 2:
        raise ValueError("Not enough valid points to perform a linear regression.")

    if np.all(x == x[0]):
        raise ValueError("All X values are identical; a slope cannot be calculated.")

    result = stats.linregress(x, y)
    r_squared = float(result.rvalue ** 2)

    return {
        "slope": float(result.slope),
        "intercept": float(result.intercept),
        "r_squared": r_squared,
    }


def is_finite_number(value):
    try:
        f = float(value)
    except (TypeError, ValueError):
        return False
    return np.isfinite(f)
