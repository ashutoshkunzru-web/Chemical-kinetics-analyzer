import os
import json

from flask import Flask, render_template, request

from services.validation import validate_manual_data, validate_csv, ValidationError
from services import integral_method, differential_method, autocatalytic, reversible, irreversible, prediction

app = Flask(__name__, static_folder='frontend', static_url_path='/frontend')

from flask_cors import CORS

CORS(app)


METHODS = {
    "integral": "Integral Method",
    "differential": "Differential Method",
    "autocatalytic": "Autocatalytic Reaction",
    "reversible": "Reversible Reaction",
    "irreversible": "Irreversible Reaction",
}


def _get_input_data(method):
    """
    Reads either the manual-entry table (submitted as a JSON string in the
    'data_json' field) or an uploaded CSV file, validates it, and returns
    the clean {"t": [...], "C": [...], ...} dict. Raises ValidationError
    with a friendly message on any problem.
    """
    extra_fields = ["C_B"] if method == "autocatalytic" else []

    csv_file = request.files.get("csv_file")
    if csv_file and csv_file.filename:
        return validate_csv(csv_file.stream, extra_fields=extra_fields)

    raw = request.form.get("data_json", "").strip()
    if not raw:
        raise ValidationError("No data was submitted. Enter data manually or upload a CSV file.")

    try:
        rows = json.loads(raw)
    except json.JSONDecodeError:
        raise ValidationError("The submitted table data could not be read.")

    return validate_manual_data(rows, extra_fields=extra_fields)


@app.route("/")
def index():
    return render_template("index.html", methods=METHODS)


@app.route("/analyze", methods=["POST"])
def analyze():
    method = request.form.get("method", "")
    if method not in METHODS:
        return render_template("index.html", methods=METHODS,
                                error="Please choose a valid analysis method.")

    try:
        data = _get_input_data(method)
        t, C = data["t"], data["C"]

        if method == "integral":
            result = integral_method.analyze(t, C, label="Integral Method")
        elif method == "differential":
            result = differential_method.analyze(t, C)
        elif method == "irreversible":
            result = irreversible.analyze(t, C)
        elif method == "autocatalytic":
            result = autocatalytic.analyze(t, C, data["C_B"])
        elif method == "reversible":
            c_ae_raw = request.form.get("c_ae", "").strip()
            c_ae = float(c_ae_raw) if c_ae_raw else None
            result = reversible.analyze(t, C, C_Ae=c_ae)

        result["method_key"] = method
        return render_template("results.html", result=result, method_key=method)

    except ValidationError as e:
        return render_template("index.html", methods=METHODS, error=str(e), selected_method=method)
    except ValueError as e:
        return render_template("index.html", methods=METHODS, error=str(e), selected_method=method)
    except Exception:
        return render_template("index.html", methods=METHODS,
                                error="An unexpected error occurred while analyzing the data. "
                                      "Please check your inputs and try again.",
                                selected_method=method)


@app.route("/predict", methods=["POST"])
def predict():
    """AJAX endpoint used by the prediction calculator on the results page."""
    from flask import jsonify

    try:
        mode = request.form.get("mode")
        n = float(request.form.get("n"))
        k = float(request.form.get("k"))
        C0 = float(request.form.get("C0"))

        if mode == "concentration":
            t = float(request.form.get("t"))
            value = prediction.predict_concentration(t, n, k, C0)
            return jsonify({"ok": True, "label": "C_A", "value": value})
        elif mode == "time":
            C = float(request.form.get("C"))
            value = prediction.predict_time(C, n, k, C0)
            return jsonify({"ok": True, "label": "t", "value": value})
        elif mode == "rate":
            C = float(request.form.get("C"))
            value = prediction.predict_rate(C, n, k)
            return jsonify({"ok": True, "label": "-r_A", "value": value})
        else:
            return jsonify({"ok": False, "error": "Unknown prediction mode."})
    except ValueError as e:
        return jsonify({"ok": False, "error": str(e)})
    except Exception:
        return jsonify({"ok": False, "error": "Could not compute a physically meaningful prediction for these inputs."})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
