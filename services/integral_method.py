"""
Integral Method for reaction order determination.

Model:  -r_A = -dC_A/dt = k * C_A^n

For n != 1:   C_A^(1-n) = C_A0^(1-n) + (n-1) k t      -> Y = C_A^(1-n), X = t
For n == 1:   ln(C_A)   = ln(C_A0) - k t               -> Y = ln(C_A),   X = t

Every candidate order is tested transparently: transform, fit, check
physical validity, accept or reject. A coarse scan is run first, then a
fine scan is run around the best coarse candidate to find a fractional
order to two decimal places.
"""

import math
import numpy as np

from services.regression import linear_fit

COARSE_ORDERS = [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3]
R2_ACCEPT_THRESHOLD = 0.95


def _transform_label(n):
    if n == 1:
        return "ln(C_A) vs t"
    if n == 0:
        return "C_A vs t"
    return f"C_A^{round(1 - n, 3)} vs t"


def _equation_label(n):
    if n == 1:
        return "ln(C_A) = ln(C_A0) - k t"
    return f"C_A^({round(1-n,3)}) = C_A0^({round(1-n,3)}) + ({round(n-1,3)}) k t"


def test_order(n, t, C):
    """
    Test a single candidate reaction order n against the data.
    Returns a fully self-describing dict used both for the comparison
    table and for the step-by-step "Reaction Order Testing" cards.
    """
    t = np.asarray(t, dtype=float)
    C = np.asarray(C, dtype=float)

    step = {
        "order": round(n, 4),
        "transformation": _transform_label(n),
        "equation": _equation_label(n),
        "x_label": "t (time)",
        "valid": False,
        "reason": "",
    }

    try:
        if n == 1:
            Y = np.log(C)
            step["y_label"] = "ln(C_A)"
        else:
            Y = np.power(C, 1 - n)
            step["y_label"] = f"C_A^{round(1-n,3)}"

        if not np.all(np.isfinite(Y)):
            step["reason"] = "The transformation produced an invalid (non-finite) value for this data."
            step.update({"slope": None, "intercept": None, "r_squared": None,
                         "rate_constant": None, "initial_concentration": None,
                         "decision": "Rejected", "points": None})
            return step

        fit = linear_fit(t, Y)
        step["slope"] = fit["slope"]
        step["intercept"] = fit["intercept"]
        step["r_squared"] = fit["r_squared"]
        step["points"] = {"x": t.tolist(), "y": Y.tolist()}

        if n == 1:
            k = -fit["slope"]
            C0 = math.exp(fit["intercept"])
        else:
            if (n - 1) == 0:
                raise ValueError("n - 1 is zero.")
            k = fit["slope"] / (n - 1)
            b = fit["intercept"]
            exponent = 1 / (1 - n)
            if b <= 0 and not float(exponent).is_integer():
                step["reason"] = "The intercept is not positive, so C_A0 cannot be recovered (fractional power of a non-positive number)."
                step.update({"rate_constant": k, "initial_concentration": None,
                             "decision": "Rejected"})
                return step
            C0 = b ** exponent if b > 0 else float("nan")

        step["rate_constant"] = k
        step["initial_concentration"] = C0

        if k <= 0:
            step["reason"] = f"Rejected: the calculated rate constant is not physically meaningful (k = {round(k,5)} \u2264 0)."
            step["decision"] = "Rejected"
            step["valid"] = False
            return step

        if not (isinstance(C0, float) and np.isfinite(C0)) or C0 <= 0:
            step["reason"] = "Rejected: the calculated initial concentration C_A0 is not physically meaningful."
            step["decision"] = "Rejected"
            step["valid"] = False
            return step

        if fit["r_squared"] < R2_ACCEPT_THRESHOLD:
            step["reason"] = (
                f"Rejected: the transformed data does not produce a strongly linear fit "
                f"(R\u00b2 = {round(fit['r_squared'],4)} < {R2_ACCEPT_THRESHOLD})."
            )
            step["decision"] = "Rejected"
            step["valid"] = False
            return step

        step["valid"] = True
        step["decision"] = "Accepted (candidate)"
        step["reason"] = f"Good linearity (R\u00b2 = {round(fit['r_squared'],4)}) with physically meaningful k and C_A0."
        return step

    except Exception as exc:
        step["reason"] = f"Could not evaluate this order: {exc}"
        step.update({"slope": None, "intercept": None, "r_squared": None,
                     "rate_constant": None, "initial_concentration": None,
                     "decision": "Rejected", "points": None})
        return step


def _best_of(results):
    valid = [r for r in results if r.get("valid")]
    pool = valid if valid else results
    scored = [r for r in pool if r.get("r_squared") is not None]
    if not scored:
        return None
    return max(scored, key=lambda r: r["r_squared"])


def analyze(t, C, label="Integral Method"):
    """
    Runs the full transparent order-testing procedure:
      1. Coarse scan over COARSE_ORDERS
      2. Refinement scan (+-0.10 in steps of 0.02) around the best coarse order
      3. Final selection, marking exactly one step as the accepted "Best"
    Returns the structured result dict used by the results page.
    """
    coarse_results = [test_order(n, t, C) for n in COARSE_ORDERS]

    best_coarse = _best_of(coarse_results)
    refine_results = []
    if best_coarse is not None:
        center = best_coarse["order"]
        deltas = [-0.10, -0.08, -0.06, -0.04, -0.02, 0.0, 0.02, 0.04, 0.06, 0.08, 0.10]
        refine_orders = sorted(set(round(center + d, 2) for d in deltas if center + d >= 0))
        refine_orders = [n for n in refine_orders if n not in [c["order"] for c in coarse_results]]
        refine_results = [test_order(n, t, C) for n in refine_orders]

    all_results = coarse_results + refine_results
    final = _best_of(all_results)

    if final is None:
        raise ValueError(
            "No tested reaction order produced a physically meaningful, well-fitted result. "
            "Check the data for measurement errors or try a wider concentration/time range."
        )

    # Mark exactly one step as Best, keep the rest as Rejected/Accepted (candidate)
    for r in all_results:
        if r is final:
            r["decision"] = "Best"
        elif r.get("valid"):
            r["decision"] = "Accepted (candidate, not best)"

    n_final = final["order"]
    k_final = final["rate_constant"]
    C0_final = final["initial_concentration"]
    n_display = round(n_final, 2)

    final_rate_equation = f"-r_A = {round(k_final,6)} * C_A^{n_display}"

    return {
        "method": label,
        "original_data": {"t": list(map(float, t)), "C": list(map(float, C))},
        "equation": "-r_A = -dC_A/dt = k * C_A^n",
        "coarse_results": coarse_results,
        "refine_results": refine_results,
        "all_results": all_results,
        "reaction_order": n_final,
        "reaction_order_display": n_display,
        "rate_constant": k_final,
        "initial_concentration": C0_final,
        "final_rate_equation": final_rate_equation,
        "best_step": final,
        "approx_note": _approx_note(n_final),
    }


def _approx_note(n):
    nearest_half = round(n * 2) / 2
    if abs(n - nearest_half) <= 0.05 and abs(n - round(n)) > 0.01:
        return f"Approximately order {nearest_half} reaction."
    return None
