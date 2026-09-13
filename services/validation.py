"""
Input validation for experimental concentration-time data.

Nothing reaches a kinetic model in this application until it has passed
through here. Every check produces a plain-language error message instead
of letting NumPy/SciPy raise a cryptic exception.
"""

import io
import math
import pandas as pd


class ValidationError(Exception):
    """Raised when submitted data fails a validation rule."""
    pass


REQUIRED_CSV_COLUMNS = {"Time", "Concentration"}


def _to_float(value, field_name, row_number):
    if value is None or str(value).strip() == "":
        raise ValidationError(f"Row {row_number}: {field_name} is empty.")
    try:
        f = float(value)
    except (TypeError, ValueError):
        raise ValidationError(f"Row {row_number}: {field_name} must be a number, got '{value}'.")
    if math.isnan(f):
        raise ValidationError(f"Row {row_number}: {field_name} is NaN.")
    if math.isinf(f):
        raise ValidationError(f"Row {row_number}: {field_name} is infinite.")
    return f


def validate_manual_data(rows, extra_fields=None):
    """
    rows: list of dicts like {"t": "0", "C": "10"} plus any extra_fields
    (e.g. "C_B" for the autocatalytic module).

    Returns a dict of clean lists: {"t": [...], "C": [...], "C_B": [...]}

    Raises ValidationError with a friendly message on any problem.
    """
    extra_fields = extra_fields or []
    if not rows or len(rows) == 0:
        raise ValidationError("No data rows were provided.")

    t_vals, c_vals = [], []
    extra_vals = {f: [] for f in extra_fields}

    for i, row in enumerate(rows, start=1):
        t = _to_float(row.get("t"), "Time", i)
        c = _to_float(row.get("C"), "Concentration", i)

        if t < 0:
            raise ValidationError(f"Row {i}: Time cannot be negative (t = {t}).")
        if c <= 0:
            raise ValidationError(f"Row {i}: Concentration must be greater than zero (C = {c}).")

        t_vals.append(t)
        c_vals.append(c)

        for f in extra_fields:
            v = _to_float(row.get(f), f, i)
            if v < 0:
                raise ValidationError(f"Row {i}: {f} cannot be negative.")
            extra_vals[f].append(v)

    if len(set(t_vals)) < len(t_vals):
        raise ValidationError("Duplicate time values were found. Each time point must be unique.")

    if len(t_vals) < 3:
        raise ValidationError("At least three valid data points are required.")

    sorted_pairs = sorted(zip(t_vals, c_vals, *[extra_vals[f] for f in extra_fields] or [[]]))
    # Re-sort every column by time to guarantee monotonic time series
    order = sorted(range(len(t_vals)), key=lambda i: t_vals[i])
    result = {
        "t": [t_vals[i] for i in order],
        "C": [c_vals[i] for i in order],
    }
    for f in extra_fields:
        result[f] = [extra_vals[f][i] for i in order]

    return result


def validate_csv(file_stream, extra_fields=None):
    """
    Parses and validates an uploaded CSV file.

    Expected columns: Time, Concentration, and optionally any of extra_fields
    (e.g. "ConcB" for autocatalytic data).
    """
    extra_fields = extra_fields or []
    try:
        raw = file_stream.read()
        if isinstance(raw, bytes):
            raw = raw.decode("utf-8-sig")
        df = pd.read_csv(io.StringIO(raw))
    except Exception:
        raise ValidationError("The uploaded file could not be read as a CSV.")

    df.columns = [str(c).strip() for c in df.columns]
    missing = REQUIRED_CSV_COLUMNS - set(df.columns)
    if missing:
        raise ValidationError(
            f"The CSV is missing required column(s): {', '.join(sorted(missing))}. "
            f"Expected headers: Time, Concentration."
        )

    for f in extra_fields:
        if f not in df.columns:
            raise ValidationError(f"The CSV is missing the required column '{f}' for this method.")

    if df.empty:
        raise ValidationError("The uploaded CSV contains no data rows.")

    rows = []
    for _, r in df.iterrows():
        row = {"t": r.get("Time"), "C": r.get("Concentration")}
        for f in extra_fields:
            row[f] = r.get(f)
        rows.append(row)

    mapped_extra = ["C_B" if f == "ConcB" else f for f in extra_fields]
    # normalize field name for downstream use
    normalized_rows = []
    for row in rows:
        new_row = {"t": row["t"], "C": row["C"]}
        for f, mf in zip(extra_fields, mapped_extra):
            new_row[mf] = row[f]
        normalized_rows.append(new_row)

    return validate_manual_data(normalized_rows, extra_fields=mapped_extra)
