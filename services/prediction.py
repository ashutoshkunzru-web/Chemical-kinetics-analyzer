"""
Prediction calculator for the final selected kinetic model -r_A = k C_A^n.

All three prediction directions are covered:
  - concentration at a given time
  - time at which a given concentration is reached
  - instantaneous rate at a given concentration

Every function validates physical meaningfulness before returning a value,
and raises ValueError with an explanation instead of returning nonsense.
"""

import math


def predict_concentration(t, n, k, C0):
    if t < 0:
        raise ValueError("Time must be greater than or equal to zero.")
    if k <= 0 or C0 <= 0:
        raise ValueError("The kinetic parameters (k, C_A0) are not physically meaningful.")

    if n == 1:
        C = C0 * math.exp(-k * t)
    else:
        base = C0 ** (1 - n) + (n - 1) * k * t
        if base <= 0:
            raise ValueError(
                "At this time, the model predicts the reaction has already gone to completion "
                "(the concentration would be zero or undefined). Try a smaller time."
            )
        C = base ** (1 / (1 - n))

    if not math.isfinite(C) or C < 0:
        raise ValueError("The predicted concentration is not physically meaningful.")
    return C


def predict_time(C, n, k, C0):
    if C <= 0:
        raise ValueError("Concentration must be greater than zero.")
    if C > C0:
        raise ValueError("The target concentration cannot exceed the initial concentration C_A0.")
    if k <= 0 or C0 <= 0:
        raise ValueError("The kinetic parameters (k, C_A0) are not physically meaningful.")

    if n == 1:
        t = math.log(C0 / C) / k
    else:
        t = (C ** (1 - n) - C0 ** (1 - n)) / ((n - 1) * k)

    if not math.isfinite(t) or t < 0:
        raise ValueError("The predicted time is not physically meaningful for this input.")
    return t


def predict_rate(C, n, k):
    if C <= 0:
        raise ValueError("Concentration must be greater than zero.")
    if k <= 0:
        raise ValueError("The rate constant is not physically meaningful.")
    rate = k * (C ** n)
    if not math.isfinite(rate) or rate < 0:
        raise ValueError("The predicted rate is not physically meaningful.")
    return rate
