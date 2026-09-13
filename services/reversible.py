"""
Reversible Reaction module.

Reaction:  A <=> B         (forward k1, reverse k2)

Mass balance (B0 = 0, 1:1 stoichiometry):   C_B = C_A0 - C_A
Rate:   -dC_A/dt = k1 C_A - k2 C_B = k1 C_A - k2 (C_A0 - C_A)

At equilibrium (-dC_A/dt = 0):  k1 C_Ae = k2 (C_A0 - C_Ae)
                                  K = k1/k2 = (C_A0 - C_Ae) / C_Ae

Integrated form:
    ln[ (C_A - C_Ae) / (C_A0 - C_Ae) ] = -(k1 + k2) t

So plotting Y = ln[(C_A - C_Ae)/(C_A0 - C_Ae)] against t gives a straight
line through the origin with slope -(k1 + k2). Combined with the
equilibrium ratio K = k1/k2, both individual rate constants can be
recovered.
"""

import math
import numpy as np

from services.regression import linear_fit


def analyze(t, C, C_Ae=None):
    t = np.asarray(t, dtype=float)
    C = np.asarray(C, dtype=float)

    C_A0 = float(C[0])
    if C_Ae is None:
        C_Ae = float(np.min(C))  # approximate equilibrium concentration from the data
    else:
        C_Ae = float(C_Ae)

    if C_Ae <= 0:
        raise ValueError("The equilibrium concentration C_Ae must be greater than zero.")
    if C_Ae >= C_A0:
        raise ValueError("The equilibrium concentration C_Ae must be less than the initial concentration C_A0.")

    denom = C_A0 - C_Ae
    numer = C - C_Ae

    if np.any(numer <= 0):
        raise ValueError(
            "Some concentration values are at or below the assumed equilibrium concentration C_Ae; "
            "the logarithm cannot be taken. Check C_Ae or the data."
        )

    Y = np.log(numer / denom)

    fit = linear_fit(t, Y)
    slope = fit["slope"]
    r_squared = fit["r_squared"]

    k_sum = -slope  # k1 + k2
    K_eq = denom / C_Ae  # k1 / k2

    if k_sum <= 0:
        raise ValueError(
            f"The calculated (k1 + k2) is not physically meaningful (value = {round(k_sum,5)}). "
            "The concentration may not actually be approaching equilibrium in this data."
        )

    k2 = k_sum / (K_eq + 1)
    k1 = K_eq * k2

    decision = "Accepted" if r_squared >= 0.9 else "Rejected"
    reason = (
        f"Good linear fit (R\u00b2 = {round(r_squared,4)}) with physically meaningful k1 and k2."
        if decision == "Accepted" else
        f"Poor linear fit (R\u00b2 = {round(r_squared,4)}); reconsider C_Ae or check the data."
    )

    final_rate_equation = f"-r_A = {round(k1,6)} * C_A - {round(k2,6)} * C_B   (A <=> B)"

    return {
        "method": "Reversible Reaction",
        "reaction": "A <=> B",
        "original_data": {"t": t.tolist(), "C": C.tolist()},
        "equation": "-dC_A/dt = k1 C_A - k2 C_B,  C_B = C_A0 - C_A",
        "transform_equation": "ln[(C_A - C_Ae) / (C_A0 - C_Ae)] = -(k1 + k2) t",
        "transform_points": {"x": t.tolist(), "y": Y.tolist()},
        "x_label": "t (time)",
        "y_label": "ln[(C_A - C_Ae)/(C_A0 - C_Ae)]",
        "slope": slope,
        "intercept": fit["intercept"],
        "r_squared": r_squared,
        "initial_concentration": C_A0,
        "equilibrium_concentration": C_Ae,
        "equilibrium_constant": K_eq,
        "forward_rate_constant": k1,
        "reverse_rate_constant": k2,
        "decision": decision,
        "reason": reason,
        "final_rate_equation": final_rate_equation,
    }
