"""
Differential Method for reaction order determination.

Model:  -r_A = -dC_A/dt = k * C_A^n

Step 1: plot C_A vs t
Step 2: numerically differentiate to get -dC_A/dt (forward difference at the
        first point, central difference for interior points, backward
        difference at the last point -- this is exactly what
        np.gradient does, including for non-uniform time spacing).
Step 3: ln(-r_A) = ln(k) + n ln(C_A)  ->  linear regression gives a
        continuous (possibly fractional) order n directly as the slope.

A transparent guess-and-test table is also produced for candidate integer
and fractional orders, fitting only k (forcing the line through the
origin in -r_A vs C_A^n space) so the two approaches can be compared.
"""

import numpy as np

from services.regression import linear_fit

CANDIDATE_ORDERS = [0, 0.5, 1, 1.5, 2, 2.5, 3]


def _numerical_derivative(t, C):
    t = np.asarray(t, dtype=float)
    C = np.asarray(C, dtype=float)
    dCdt = np.gradient(C, t)  # forward/backward at edges, central inside; handles non-uniform spacing
    return dCdt


def _guess_and_test(C, rate):
    """
    For each candidate order n, fit -r_A = k * C_A^n forcing the line
    through the origin (b = 0), then report slope=k and R^2 of that fit.
    """
    C = np.asarray(C, dtype=float)
    rate = np.asarray(rate, dtype=float)
    results = []
    for n in CANDIDATE_ORDERS:
        X = np.power(C, n)
        mask = np.isfinite(X) & np.isfinite(rate)
        Xm, Ym = X[mask], rate[mask]
        if len(Xm) < 2 or np.all(Xm == 0):
            results.append({
                "order": n, "transformation": f"-r_A vs C_A^{n}",
                "slope": None, "intercept": 0, "r_squared": None,
                "rate_constant": None, "decision": "Rejected",
                "reason": "Transformation could not be evaluated.",
            })
            continue

        k = float(np.sum(Xm * Ym) / np.sum(Xm ** 2))
        y_pred = k * Xm
        ss_res = float(np.sum((Ym - y_pred) ** 2))
        ss_tot = float(np.sum((Ym - np.mean(Ym)) ** 2))
        r2 = 1 - ss_res / ss_tot if ss_tot > 0 else (1.0 if ss_res < 1e-12 else 0.0)

        valid = k > 0 and r2 >= 0.9
        decision = "Accepted (candidate)" if valid else "Rejected"
        reason = (
            f"Good fit with k = {round(k,5)} (R\u00b2 = {round(r2,4)})."
            if valid else
            f"Poor fit or non-physical k (k = {round(k,5)}, R\u00b2 = {round(r2,4)})."
        )
        results.append({
            "order": n, "transformation": f"-r_A vs C_A^{n}",
            "slope": k, "intercept": 0.0, "r_squared": r2,
            "rate_constant": k, "decision": decision, "reason": reason,
        })
    return results


def analyze(t, C):
    t = np.asarray(t, dtype=float)
    C = np.asarray(C, dtype=float)

    dCdt = _numerical_derivative(t, C)
    rate = -dCdt

    derivative_table = [
        {"t": float(t[i]), "C": float(C[i]), "dCdt": float(dCdt[i]), "rate": float(rate[i])}
        for i in range(len(t))
    ]

    mask = rate > 0
    if mask.sum() < 2:
        raise ValueError(
            "The numerically differentiated rate is not positive at enough points to take a logarithm. "
            "The data may be too noisy, non-monotonic, or too sparse for the differential method."
        )

    logC = np.log(C[mask])
    logRate = np.log(rate[mask])
    fit = linear_fit(logC, logRate)

    n = fit["slope"]
    k = float(np.exp(fit["intercept"]))

    guess_test = _guess_and_test(C[mask], rate[mask])

    n_display = round(n, 2)
    final_rate_equation = f"-r_A = {round(k,6)} * C_A^{n_display}"

    return {
        "method": "Differential Method",
        "original_data": {"t": list(map(float, t)), "C": list(map(float, C))},
        "equation": "-r_A = -dC_A/dt = k * C_A^n  =>  ln(-r_A) = ln(k) + n ln(C_A)",
        "derivative_table": derivative_table,
        "loglog_points": {"x": logC.tolist(), "y": logRate.tolist()},
        "x_label": "ln(C_A)",
        "y_label": "ln(-r_A)",
        "slope": fit["slope"],
        "intercept": fit["intercept"],
        "r_squared": fit["r_squared"],
        "reaction_order": n,
        "reaction_order_display": n_display,
        "rate_constant": k,
        "guess_and_test": guess_test,
        "final_rate_equation": final_rate_equation,
    }
