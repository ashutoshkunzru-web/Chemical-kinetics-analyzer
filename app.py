import os
import json
import csv
import io
from flask import Flask, render_template, request, jsonify, Response
from flask_cors import CORS

from services.validation import validate_manual_data, validate_csv, ValidationError
from services import integral_method, differential_method, autocatalytic, reversible, irreversible, prediction

app = Flask(__name__, template_folder='frontend', static_folder='frontend')
CORS(app)

METHODS = {
    "integral": "Integral Method (nth-order scan & refinement)",
    "differential": "Differential Method (numerical differentiation)",
    "irreversible": "Irreversible Reaction (A \u2192 Products)",
    "reversible": "Reversible Reaction (A \u21cc B)",
    "autocatalytic": "Autocatalytic Reaction (A + B \u2192 2B)",
}

SAMPLE_DATASETS = {
    "integral": {
        "title": "First-Order Decomposition (e.g. N2O5 \u2192 2NO2 + 1/2 O2)",
        "method": "integral",
        "description": "Clean exponential decay matching first-order kinetics (n = 1.0, k \u2248 0.05 min\u207b\u00b9).",
        "rows": [
            {"t": "0", "C": "10.00"},
            {"t": "5", "C": "7.79"},
            {"t": "10", "C": "6.07"},
            {"t": "15", "C": "4.72"},
            {"t": "20", "C": "3.68"},
            {"t": "30", "C": "2.23"},
            {"t": "40", "C": "1.35"},
            {"t": "50", "C": "0.82"},
            {"t": "60", "C": "0.50"}
        ]
    },
    "differential": {
        "title": "Second-Order Gas Phase Pyrolysis (n \u2248 2.0)",
        "method": "differential",
        "description": "High non-linearity suitable for continuous slope extraction on ln(-rA) vs ln(CA).",
        "rows": [
            {"t": "0", "C": "20.00"},
            {"t": "10", "C": "10.00"},
            {"t": "20", "C": "6.67"},
            {"t": "30", "C": "5.00"},
            {"t": "40", "C": "4.00"},
            {"t": "50", "C": "3.33"},
            {"t": "60", "C": "2.86"},
            {"t": "80", "C": "2.22"},
            {"t": "100", "C": "1.82"}
        ]
    },
    "irreversible": {
        "title": "Second-Order Ester Saponification (A \u2192 Products)",
        "method": "irreversible",
        "description": "Equimolar hydrolysis with k \u2248 0.02 L/(mol\u00b7min).",
        "rows": [
            {"t": "0", "C": "5.00"},
            {"t": "10", "C": "2.50"},
            {"t": "20", "C": "1.67"},
            {"t": "30", "C": "1.25"},
            {"t": "45", "C": "0.91"},
            {"t": "60", "C": "0.71"},
            {"t": "90", "C": "0.50"}
        ]
    },
    "reversible": {
        "title": "Reversible Isomerization (A \u21cc B, CA0 = 10, CAe = 2.5)",
        "method": "reversible",
        "description": "Reaction asymptotically approaches equilibrium concentration CAe = 2.5 mol/L.",
        "c_ae": "2.5",
        "rows": [
            {"t": "0", "C": "10.00"},
            {"t": "5", "C": "7.38"},
            {"t": "10", "C": "5.68"},
            {"t": "15", "C": "4.57"},
            {"t": "20", "C": "3.85"},
            {"t": "30", "C": "3.08"},
            {"t": "40", "C": "2.73"},
            {"t": "60", "C": "2.54"}
        ]
    },
    "autocatalytic": {
        "title": "Autocatalytic Ester Hydrolysis (A + B \u2192 2B)",
        "method": "autocatalytic",
        "description": "Sigmoidal decay of reactant A as product B accelerates its own generation.",
        "rows": [
            {"t": "0", "C": "9.90", "C_B": "0.10"},
            {"t": "10", "C": "9.50", "C_B": "0.50"},
            {"t": "20", "C": "8.50", "C_B": "1.50"},
            {"t": "30", "C": "6.50", "C_B": "3.50"},
            {"t": "40", "C": "3.50", "C_B": "6.50"},
            {"t": "50", "C": "1.50", "C_B": "8.50"},
            {"t": "60", "C": "0.50", "C_B": "9.50"},
            {"t": "70", "C": "0.10", "C_B": "9.90"}
        ]
    }
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
        raise ValidationError("No data was submitted. Please enter data points in the table or upload a CSV file.")

    try:
        rows = json.loads(raw)
    except json.JSONDecodeError:
        raise ValidationError("The submitted table data could not be read. Please check your inputs.")

    return validate_manual_data(rows, extra_fields=extra_fields)


@app.route("/")
def index():
    return render_template("index.html", methods=METHODS, sample_datasets=SAMPLE_DATASETS)


@app.route("/sample-data/<method>")
def get_sample_data(method):
    sample = SAMPLE_DATASETS.get(method)
    if not sample:
        return jsonify({"ok": False, "error": f"No sample dataset for method '{method}'"}), 404
    return jsonify({"ok": True, "data": sample})


@app.route("/download-sample-csv/<method>")
def download_sample_csv(method):
    sample = SAMPLE_DATASETS.get(method)
    if not sample:
        return Response("Dataset not found", status=404)

    output = io.StringIO()
    writer = csv.writer(output)
    if method == "autocatalytic":
        writer.writerow(["Time", "Concentration", "ConcB"])
        for row in sample["rows"]:
            writer.writerow([row["t"], row["C"], row.get("C_B", "")])
    else:
        writer.writerow(["Time", "Concentration"])
        for row in sample["rows"]:
            writer.writerow([row["t"], row["C"]])

    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": f"attachment;filename=sample_{method}_data.csv"}
    )


@app.route("/analyze", methods=["POST"])
def analyze():
    method = request.form.get("method", "")
    if method not in METHODS:
        return render_template("index.html", methods=METHODS, sample_datasets=SAMPLE_DATASETS,
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
        return render_template("index.html", methods=METHODS, sample_datasets=SAMPLE_DATASETS,
                               error=str(e), selected_method=method)
    except ValueError as e:
        return render_template("index.html", methods=METHODS, sample_datasets=SAMPLE_DATASETS,
                               error=str(e), selected_method=method)
    except Exception as exc:
        return render_template("index.html", methods=METHODS, sample_datasets=SAMPLE_DATASETS,
                               error=f"An unexpected error occurred: {str(exc)}. Please verify your data points and try again.",
                               selected_method=method)


@app.route("/predict", methods=["POST"])
def predict():
    """AJAX endpoint used by the prediction calculator on the results page."""
    try:
        mode = request.form.get("mode")
        n = float(request.form.get("n"))
        k = float(request.form.get("k"))
        C0 = float(request.form.get("C0"))

        if mode == "concentration":
            t = float(request.form.get("t"))
            value = prediction.predict_concentration(t, n, k, C0)
            conversion = ((C0 - value) / C0) * 100 if C0 > 0 else 0
            return jsonify({
                "ok": True,
                "label": "C_A",
                "value": value,
                "conversion": round(conversion, 2),
                "unit": "mol/L"
            })
        elif mode == "time":
            C = float(request.form.get("C"))
            value = prediction.predict_time(C, n, k, C0)
            conversion = ((C0 - C) / C0) * 100 if C0 > 0 else 0
            return jsonify({
                "ok": True,
                "label": "t",
                "value": value,
                "conversion": round(conversion, 2),
                "unit": "time units"
            })
        elif mode == "rate":
            C = float(request.form.get("C"))
            value = prediction.predict_rate(C, n, k)
            return jsonify({
                "ok": True,
                "label": "-r_A",
                "value": value,
                "unit": "mol/(L\u00b7time)"
            })
        else:
            return jsonify({"ok": False, "error": "Unknown prediction mode."})
    except ValueError as e:
        return jsonify({"ok": False, "error": str(e)})
    except Exception as e:
        return jsonify({"ok": False, "error": f"Prediction error: {str(e)}"})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    app.run(host="0.0.0.0", port=port, debug=True)

