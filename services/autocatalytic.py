"""
Autocatalytic Reaction module.

Reaction:  A + B -> 2B   (the product B accelerates its own formation)

Rate law:  -r_A = k * C_A * C_B

The user supplies measured C_A and C_B at each time point (two-column
data beyond time). The rate -dC_A/dt is obtained by numerical
differentiation (same forward/central/backward scheme as the
Differential Method), and the model is linearized by plotting

    -r_A  vs  C_A * C_B

which passes through the origin with slope k. This keeps every
transformation, axis, and regression step visible to the user.
"""

import numpy as np

from services.regression import linear_fit


def analyze(t, C_A, C_B):
    t = np.asarray(t, dtype=float)
    C_A = np.asarray(C_A, dtype=float)
    C_B = np.asarray(C_B, dtype=float)

    dCadt = np.gradient(C_A, t)
    rate = -dCadt

    X = C_A * C_B  # the linearizing variable

    derivative_table = [
        {"t": float(t[i]), "C_A": float(C_A[i]), "C_B": float(C_B[i]),
         "dCadt": float(dCadt[i]), "rate": float(rate[i]), "X": float(X[i])}
        for i in range(len(t))
    ]

    mask = np.isfinite(X) & np.isfinite(rate)
    Xm, Ym = X[mask], rate[mask]
    if len(Xm) < 3:
        raise ValueError("Not enough valid points to fit the autocatalytic rate model.")

    # Force the fit through the origin: -r_A = k * (C_A * C_B)
    k = float(np.sum(Xm * Ym) / np.sum(Xm ** 2))
    y_pred = k * Xm
    ss_res = float(np.sum((Ym - y_pred) ** 2))
    ss_tot = float(np.sum((Ym - np.mean(Ym)) ** 2))
    r_squared = 1 - ss_res / ss_tot if ss_tot > 0 else (1.0 if ss_res < 1e-12 else 0.0)

    decision = "Accepted" if (k > 0 and r_squared >= 0.9) else "Rejected"
    reason = (
        f"Good linear fit through the origin (R\u00b2 = {round(r_squared,4)}) with physically meaningful k."
        if decision == "Accepted" else
        f"Poor fit or non-physical k (k = {round(k,5)}, R\u00b2 = {round(r_squared,4)})."
    )

    final_rate_equation = f"-r_A = {round(k,6)} * C_A * C_B"

    return {
        "method": "Autocatalytic Reaction",
        "reaction": "A + B -> 2B",
        "original_data": {"t": t.tolist(), "C_A": C_A.tolist(), "C_B": C_B.tolist()},
        "equation": "-r_A = k * C_A * C_B",
        "derivative_table": derivative_table,
        "transform_points": {"x": Xm.tolist(), "y": Ym.tolist()},
        "x_label": "C_A * C_B",
        "y_label": "-r_A",
        "slope": k,
        "intercept": 0.0,
        "r_squared": r_squared,
        "rate_constant": k,
        "decision": decision,
        "reason": reason,
        "final_rate_equation": final_rate_equation,
    }
