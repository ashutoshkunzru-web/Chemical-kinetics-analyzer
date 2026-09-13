// Chemical Reaction Kinetics Analyzer -- results page graphs & prediction calculator

(function () {
  const result = window.RESULT_DATA;
  const methodKey = window.METHOD_KEY;
  if (!result) return;

  const PLOT_LAYOUT_BASE = {
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: { family: "Inter, sans-serif", color: "#3E332C" },
    margin: { t: 50, r: 30, b: 55, l: 60 },
  };

  function regressionLine(x, slope, intercept) {
    const xs = [Math.min(...x), Math.max(...x)];
    return { x: xs, y: xs.map((v) => slope * v + intercept) };
  }

  function plotFit(divId, title, xLabel, yLabel, points, slope, intercept, r2) {
    const el = document.getElementById(divId);
    if (!el) return;
    const line = regressionLine(points.x, slope, intercept);
    const traceScatter = {
      x: points.x,
      y: points.y,
      mode: "markers",
      name: "Experimental data",
      marker: { color: "#AD9C8E", size: 9 },
    };
    const traceLine = {
      x: line.x,
      y: line.y,
      mode: "lines",
      name: `Best fit (R\u00b2 = ${r2.toFixed(4)})`,
      line: { color: "#8a6d1f", width: 2, dash: "solid" },
    };
    Plotly.newPlot(
      el,
      [traceScatter, traceLine],
      Object.assign({}, PLOT_LAYOUT_BASE, {
        title: title,
        xaxis: { title: xLabel, gridcolor: "#F0E7D8" },
        yaxis: { title: yLabel, gridcolor: "#F0E7D8" },
      }),
      { responsive: true, displaylogo: false }
    );
  }

  if (methodKey === "integral" || methodKey === "irreversible") {
    const best = result.best_step;
    plotFit(
      "bestFitGraph",
      `Best fit: order n = ${result.reaction_order_display}`,
      best.x_label,
      best.y_label,
      best.points,
      best.slope,
      best.intercept,
      best.r_squared
    );
  }

  if (methodKey === "differential") {
    plotFit(
      "loglogGraph",
      "ln(-r_A) vs ln(C_A)",
      result.x_label,
      result.y_label,
      result.loglog_points,
      result.slope,
      result.intercept,
      result.r_squared
    );
  }

  if (methodKey === "autocatalytic") {
    plotFit(
      "autocatGraph",
      "-r_A vs C_A\u00b7C_B",
      result.x_label,
      result.y_label,
      result.transform_points,
      result.slope,
      result.intercept,
      result.r_squared
    );
  }

  if (methodKey === "reversible") {
    plotFit(
      "reversibleGraph",
      "ln[(C_A - C_Ae)/(C_A0 - C_Ae)] vs t",
      result.x_label,
      result.y_label,
      result.transform_points,
      result.slope,
      result.intercept,
      result.r_squared
    );
  }

  // ---- Prediction calculator ----
  const predictGrid = document.querySelector(".predict-grid");
  if (predictGrid) {
    const n = predictGrid.getAttribute("data-n");
    const k = predictGrid.getAttribute("data-k");
    const C0 = predictGrid.getAttribute("data-c0");

    document.querySelectorAll(".predict-btn").forEach((btn) => {
      btn.addEventListener("click", function () {
        const mode = btn.getAttribute("data-mode");
        const box = btn.closest(".predict-box");
        const input = box.querySelector(".pred-input");
        const resultEl = box.querySelector(".predict-result");
        const field = input.getAttribute("data-field");

        const formData = new FormData();
        formData.append("mode", mode);
        formData.append("n", n);
        formData.append("k", k);
        formData.append("C0", C0);
        formData.append(field, input.value);

        resultEl.textContent = "Calculating\u2026";

        fetch(window.PREDICT_URL || "/predict", { method: "POST", body: formData })
          .then((r) => r.json())
          .then((data) => {
            if (data.ok) {
              resultEl.textContent = `${data.label} = ${Number(data.value).toPrecision(6)}`;
              resultEl.style.color = "";
            } else {
              resultEl.textContent = data.error;
              resultEl.style.color = "#A94438";
            }
          })
          .catch(() => {
            resultEl.textContent = "Could not reach the server.";
            resultEl.style.color = "#A94438";
          });
      });
    });
  }
})();
