"""
Irreversible Reaction module.

An irreversible reaction A -> products with rate law -r_A = k C_A^n uses
exactly the same integral-method order-testing engine as the Integral
Method module. It is kept as a separate module (per the project spec) so
its labeling, and any future irreversible-specific extensions (e.g.
multiple reactants), can evolve independently of the general Integral
Method page.
"""

from services.integral_method import analyze as integral_analyze


def analyze(t, C):
    result = integral_analyze(t, C, label="Irreversible Reaction")
    result["equation"] = "A -> Products,   -r_A = k * C_A^n"
    return result
