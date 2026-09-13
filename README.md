# Chemical Reaction Kinetics Analyzer

An interactive Flask web application for a Chemical Reaction Engineering
university project. It analyzes experimental concentration-time data and
determines reaction order, rate constant, and initial concentration &mdash;
showing the **complete methodology**, not just a final answer.

## Features

- Five analysis modules: **Integral Method**, **Differential Method**,
  **Autocatalytic Reaction**, **Reversible Reaction**, **Irreversible Reaction**
- Transparent, step-by-step order testing (guess an order &rarr; transform &rarr;
  plot &rarr; regress &rarr; accept/reject &rarr; test the next order)
- Coarse scan over integer and quarter-integer orders (0 to 3), followed by
  a fractional-order refinement pass around the best candidate
- Manual data entry (editable table, add/remove rows) or CSV upload
- Full input validation with friendly error messages (no crashes on bad data)
- Interactive Plotly graphs with regression lines, equations, and R&sup2;
- A comparison table across every tested order
- A prediction calculator: concentration at time *t*, time to reach a target
  concentration, or instantaneous rate at a given concentration
- Clean, responsive interface (palette: cream `#F7E6CA`, gold `#E8D59E`,
  rose `#D9BBB0`, mocha `#AD9C8E`)

## Methods

| Method | Rate Equation | Linearization |
|---|---|---|
| Integral | -r_A = k C_A^n | C_A^(1-n) vs t (or ln C_A vs t for n=1) |
| Differential | -r_A = k C_A^n | ln(-r_A) vs ln(C_A), numerically differentiated |
| Autocatalytic | -r_A = k C_A C_B | -r_A vs C_A&middot;C_B |
| Reversible | -dC_A/dt = k1 C_A - k2 C_B | ln[(C_A-C_Ae)/(C_A0-C_Ae)] vs t |
| Irreversible | -r_A = k C_A^n | Same engine as Integral Method |

## Installation

```bash
git clone <your-repo-url>
cd chemical-kinetics-analyzer
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS/Linux
pip install -r requirements.txt
```

## Local execution

```bash
python app.py
```

Then open **http://127.0.0.1:5001** in your browser.

## Project structure

```
chemical-kinetics-analyzer/
├── app.py
├── requirements.txt
├── Procfile
├── runtime.txt
├── .gitignore
├── README.md
├── services/
│   ├── __init__.py
│   ├── validation.py
│   ├── regression.py
│   ├── integral_method.py
│   ├── differential_method.py
│   ├── autocatalytic.py
│   ├── reversible.py
│   ├── irreversible.py
│   └── prediction.py
├── templates/
│   ├── base.html
│   ├── index.html
│   └── results.html
└── static/
    ├── css/style.css
    └── js/
        ├── main.js
        └── results_graphs.js
```

## Input format

**Manual entry:** an editable table of Time / Concentration pairs (and a
Concentration-of-B column for the Autocatalytic module).

**CSV upload:**

```csv
Time,Concentration
0,10
20,8
40,6
60,5
```

The Autocatalytic module additionally requires a `C_B` column.

## Mathematical methodology

For the Integral and Irreversible modules, the app tests reaction orders
`n = 0, 0.25, 0.5, ..., 3`. For `n \u2260 1` it linearizes

```
C_A^(1-n) = C_A0^(1-n) + (n-1) k t
```

and for `n = 1` it uses `ln(C_A) = ln(C_A0) - k t`. Each candidate is fit by
linear regression, checked for a physically meaningful `k > 0` and
`C_A0 > 0`, and accepted only if the fit is strongly linear (R&sup2; &ge; 0.95).
The best coarse candidate is then refined in steps of 0.02 to find a
fractional order (e.g. `n = 1.47`).

The Differential module numerically differentiates `C_A` vs `t` (forward
difference at the first point, central difference for interior points,
backward difference at the last point) and fits `ln(-r_A) = ln k + n ln(C_A)`
directly for a continuous order.

## Deployment (Render)

1. Push this project to a GitHub repository.
2. Create a free account at [render.com](https://render.com) and sign in with GitHub.
3. Click **New +** &rarr; **Web Service**, then select your repository.
4. Environment: **Python 3**.
5. Build command: `pip install -r requirements.txt`
6. Start command: `gunicorn app:app --bind 0.0.0.0:$PORT`
7. Click **Create Web Service** and wait for the build/deploy to finish.
8. Open the public `.onrender.com` URL Render gives you.

### Common deployment errors

| Error | Fix |
|---|---|
| `ModuleNotFoundError` | A package is missing from `requirements.txt` &mdash; add it and redeploy. |
| Gunicorn fails to start | Check the start command matches `app:app` (module:variable). |
| Port binding error | Never hardcode a port; always bind to `$PORT` (already done in the Procfile). |
| `TemplateNotFound` | Ensure `templates/` was committed and sits next to `app.py`. |
| Static files not loading | Ensure `static/` was committed; confirm `url_for('static', ...)` is used in templates. |
| Python version mismatch | Adjust `runtime.txt` to a version Render supports. |

## Notes

This tool only processes data you enter manually or upload as a CSV file.
It does not access external files, credentials, or unrelated systems.
