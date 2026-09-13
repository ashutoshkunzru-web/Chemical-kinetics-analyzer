// Chemical Reaction Kinetics Analyzer -- Multi-View Scientific Visualizations & Prediction Logic

(function () {
  const result = window.RESULT_DATA;
  const methodKey = window.METHOD_KEY;
  if (!result) return;

  // ---- 1. Theme Configuration for Plotly ----
  function getPlotlyTheme() {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    return {
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: isDark ? "rgba(17, 24, 39, 0.6)" : "rgba(248, 250, 252, 0.8)",
      font: {
        family: "Inter, -apple-system, sans-serif",
        color: isDark ? "#f8fafc" : "#0f172a",
        size: 12
      },
      gridcolor: isDark ? "#334155" : "#e2e8f0",
      zerolinecolor: isDark ? "#475569" : "#cbd5e1",
      accentLine: isDark ? "#60a5fa" : "#2563eb",
      scatterMarker: isDark ? "#38bdf8" : "#0284c7",
      bestFitLine: isDark ? "#34d399" : "#059669",
      winnerBar: isDark ? "#10b981" : "#059669",
      candidateBar: isDark ? "#64748b" : "#94a3b8"
    };
  }

  const PLOT_CONFIG = {
    responsive: true,
    displayModeBar: true,
    displaylogo: false,
    modeBarButtonsToRemove: ["lasso2d", "select2d"]
  };

  // ---- 2. Render Primary Linearized Fit Plot ----
  function renderLinearFitPlot() {
    const el = document.getElementById("linearFitPlot");
    if (!el) return;

    const theme = getPlotlyTheme();
    let points = null;
    let slope = 0;
    let intercept = 0;
    let r2 = 0;
    let xTitle = "Time (t)";
    let yTitle = "Transformed Variable";
    let plotTitle = "Linearized Kinetic Fit";

    if (methodKey === "integral" || methodKey === "irreversible") {
      const best = result.best_step;
      if (!best) return;
      points = best.points;
      slope = best.slope;
      intercept = best.intercept;
      r2 = best.r_squared || 0;
      xTitle = best.x_label || "Time (t)";
      yTitle = best.y_label || "Y";
      plotTitle = `Linear Fit: Order n = ${result.reaction_order_display} (R\u00b2 = ${r2.toFixed(4)})`;
    } else if (methodKey === "differential") {
      points = result.loglog_points;
      slope = result.slope;
      intercept = result.intercept;
      r2 = result.r_squared || 0;
      xTitle = result.x_label || "ln(C_A)";
      yTitle = result.y_label || "ln(-r_A)";
      plotTitle = `Differential Log-Log Fit: n = ${result.reaction_order_display} (R\u00b2 = ${r2.toFixed(4)})`;
    } else if (methodKey === "autocatalytic") {
      points = result.transform_points;
      slope = result.slope;
      intercept = result.intercept;
      r2 = result.r_squared || 0;
      xTitle = result.x_label || "C_A \u00b7 C_B";
      yTitle = result.y_label || "-r_A";
      plotTitle = `Autocatalytic Origin Linearization (k = ${slope.toPrecision(4)})`;
    } else if (methodKey === "reversible") {
      points = result.transform_points;
      slope = result.slope;
      intercept = result.intercept;
      r2 = result.r_squared || 0;
      xTitle = result.x_label || "Time (t)";
      yTitle = result.y_label || "ln[(C_A - C_Ae)/(C_A0 - C_Ae)]";
      plotTitle = `Reversible Linearization: -(k1 + k2) = ${slope.toPrecision(4)}`;
    }

    if (!points || !points.x || points.x.length === 0) return;

    const minX = Math.min(...points.x);
    const maxX = Math.max(...points.x);
    const padding = (maxX - minX) * 0.05 || 1;
    const lineX = [Math.max(0, minX - padding), maxX + padding];
    const lineY = lineX.map(x => slope * x + intercept);

    const traceData = {
      x: points.x,
      y: points.y,
      mode: "markers",
      name: "Transformed Data",
      marker: {
        color: theme.scatterMarker,
        size: 9,
        line: { color: "#ffffff", width: 1.5 }
      },
      type: "scatter"
    };

    const traceLine = {
      x: lineX,
      y: lineY,
      mode: "lines",
      name: `Regression Line (R\u00b2 = ${r2.toFixed(4)})`,
      line: {
        color: theme.bestFitLine,
        width: 2.5
      },
      type: "scatter"
    };

    const layout = {
      title: { text: plotTitle, font: { size: 15, family: "Outfit, sans-serif" } },
      paper_bgcolor: theme.paper_bgcolor,
      plot_bgcolor: theme.plot_bgcolor,
      font: theme.font,
      margin: { t: 50, r: 30, b: 50, l: 60 },
      xaxis: {
        title: xTitle,
        gridcolor: theme.gridcolor,
        zerolinecolor: theme.zerolinecolor
      },
      yaxis: {
        title: yTitle,
        gridcolor: theme.gridcolor,
        zerolinecolor: theme.zerolinecolor
      },
      legend: { orientation: "h", y: 1.12, x: 0 }
    };

    Plotly.react(el, [traceData, traceLine], layout, PLOT_CONFIG);
  }

  // ---- 3. Render Continuous Non-Linear CA(t) Simulation Plot ----
  function renderConcentrationTimePlot() {
    const el = document.getElementById("concentrationTimePlot");
    if (!el) return;

    const theme = getPlotlyTheme();
    const orig = result.original_data;
    if (!orig || !orig.t || orig.t.length === 0) return;

    const tExp = orig.t;
    const cExp = orig.C || orig.C_A;
    const maxT = Math.max(...tExp);
    const C0 = result.initial_concentration || cExp[0] || 10;
    const n = result.reaction_order || 1;
    const k = result.rate_constant || result.forward_rate_constant || 0.05;

    // Generate smooth continuous simulation curve (120 points)
    const tSim = [];
    const cSim = [];
    const steps = 120;
    const tEnd = maxT * 1.15 || 100;

    for (let i = 0; i <= steps; i++) {
      const t = (tEnd / steps) * i;
      tSim.push(t);

      let cVal = 0;
      if (methodKey === "reversible") {
        const C_Ae = result.equilibrium_concentration || (cExp[cExp.length - 1] * 0.9);
        const kSum = -(result.slope || -0.1);
        cVal = C_Ae + (C0 - C_Ae) * Math.exp(-kSum * t);
      } else if (methodKey === "autocatalytic") {
        // Autocatalytic sigmoidal trajectory approximation
        const C_B0 = orig.C_B ? orig.C_B[0] : 0.1;
        const C_total = C0 + C_B0;
        cVal = C_total / (1 + (C_B0 / C0) * Math.exp(k * C_total * t));
      } else {
        if (Math.abs(n - 1.0) < 1e-4) {
          cVal = C0 * Math.exp(-k * t);
        } else if (Math.abs(n) < 1e-4) {
          cVal = Math.max(0, C0 - k * t);
        } else {
          const base = Math.pow(C0, 1 - n) + (n - 1) * k * t;
          cVal = base > 0 ? Math.pow(base, 1 / (1 - n)) : 0;
        }
      }
      cSim.push(Math.max(0, cVal));
    }

    const traceExp = {
      x: tExp,
      y: cExp,
      mode: "markers",
      name: "Experimental Observations (C_A)",
      marker: {
        color: theme.scatterMarker,
        size: 9,
        line: { color: "#ffffff", width: 1.5 }
      },
      type: "scatter"
    };

    const traceModel = {
      x: tSim,
      y: cSim,
      mode: "lines",
      name: `Simulated Kinetic Decay Curve`,
      line: {
        color: theme.accentLine,
        width: 2.5
      },
      type: "scatter"
    };

    const layout = {
      title: { text: "Concentration vs Time: Experimental Data & Kinetic Model", font: { size: 15, family: "Outfit, sans-serif" } },
      paper_bgcolor: theme.paper_bgcolor,
      plot_bgcolor: theme.plot_bgcolor,
      font: theme.font,
      margin: { t: 50, r: 30, b: 50, l: 60 },
      xaxis: {
        title: "Reaction Time (t)",
        gridcolor: theme.gridcolor,
        zerolinecolor: theme.zerolinecolor
      },
      yaxis: {
        title: "Concentration C_A (mol/L)",
        gridcolor: theme.gridcolor,
        zerolinecolor: theme.zerolinecolor
      },
      legend: { orientation: "h", y: 1.12, x: 0 }
    };

    Plotly.react(el, [traceExp, traceModel], layout, PLOT_CONFIG);
  }

  // ---- 4. Render Residuals Analysis Plot ----
  function renderResidualsPlot() {
    const el = document.getElementById("residualsPlot");
    if (!el) return;

    const theme = getPlotlyTheme();
    const orig = result.original_data;
    if (!orig || !orig.t) return;

    const tExp = orig.t;
    const cExp = orig.C || orig.C_A;
    const C0 = result.initial_concentration || cExp[0] || 10;
    const n = result.reaction_order || 1;
    const k = result.rate_constant || result.forward_rate_constant || 0.05;

    const residuals = [];
    tExp.forEach((t, i) => {
      let cModel = 0;
      if (methodKey === "reversible") {
        const C_Ae = result.equilibrium_concentration || (cExp[cExp.length - 1] * 0.9);
        const kSum = -(result.slope || -0.1);
        cModel = C_Ae + (C0 - C_Ae) * Math.exp(-kSum * t);
      } else {
        if (Math.abs(n - 1.0) < 1e-4) {
          cModel = C0 * Math.exp(-k * t);
        } else if (Math.abs(n) < 1e-4) {
          cModel = Math.max(0, C0 - k * t);
        } else {
          const base = Math.pow(C0, 1 - n) + (n - 1) * k * t;
          cModel = base > 0 ? Math.pow(base, 1 / (1 - n)) : 0;
        }
      }
      residuals.push(cExp[i] - cModel);
    });

    const traceRes = {
      x: tExp,
      y: residuals,
      mode: "markers",
      name: "Residual (e_i = C_A,obs - C_A,model)",
      marker: {
        color: theme.scatterMarker,
        size: 9,
        line: { color: "#ffffff", width: 1.5 }
      },
      type: "scatter"
    };

    const minT = Math.min(...tExp);
    const maxT = Math.max(...tExp);
    const traceZero = {
      x: [minT, maxT],
      y: [0, 0],
      mode: "lines",
      name: "Zero Error Baseline",
      line: { color: theme.zerolinecolor, dash: "dash", width: 1.5 },
      type: "scatter"
    };

    const layout = {
      title: { text: "Model Residuals Distribution Across Reaction Time", font: { size: 15, family: "Outfit, sans-serif" } },
      paper_bgcolor: theme.paper_bgcolor,
      plot_bgcolor: theme.plot_bgcolor,
      font: theme.font,
      margin: { t: 50, r: 30, b: 50, l: 60 },
      xaxis: {
        title: "Time (t)",
        gridcolor: theme.gridcolor,
        zerolinecolor: theme.zerolinecolor
      },
      yaxis: {
        title: "Residual Error (mol/L)",
        gridcolor: theme.gridcolor,
        zerolinecolor: theme.zerolinecolor
      },
      legend: { orientation: "h", y: 1.12, x: 0 }
    };

    Plotly.react(el, [traceZero, traceRes], layout, PLOT_CONFIG);
  }

  // ---- 5. Render Tested Candidate Orders R² Bar Chart ----
  function renderOrdersComparisonPlot() {
    const el = document.getElementById("ordersComparisonPlot");
    if (!el || !result.coarse_results) return;

    const theme = getPlotlyTheme();
    const orders = [];
    const r2s = [];
    const colors = [];

    result.coarse_results.forEach(step => {
      orders.push(`n = ${step.order}`);
      const val = step.r_squared !== null && step.r_squared !== undefined ? Math.max(0, step.r_squared) : 0;
      r2s.push(val);
      colors.push(step.decision === "Best" ? theme.winnerBar : theme.candidateBar);
    });

    const traceBar = {
      x: orders,
      y: r2s,
      type: "bar",
      marker: { color: colors },
      text: r2s.map(v => v > 0 ? v.toFixed(4) : "N/A"),
      textposition: "auto"
    };

    const layout = {
      title: { text: "Goodness of Fit (R\u00b2) Across Candidate Reaction Orders", font: { size: 15, family: "Outfit, sans-serif" } },
      paper_bgcolor: theme.paper_bgcolor,
      plot_bgcolor: theme.plot_bgcolor,
      font: theme.font,
      margin: { t: 50, r: 30, b: 50, l: 60 },
      xaxis: { title: "Candidate Order", gridcolor: theme.gridcolor },
      yaxis: {
        title: "Coefficient of Determination R\u00b2",
        range: [0, 1.05],
        gridcolor: theme.gridcolor
      }
    };

    Plotly.react(el, [traceBar], layout, PLOT_CONFIG);
  }

  // Initial render of active tab plot
  renderLinearFitPlot();

  // ---- 6. Plot View Tab Switching ----
  const plotTabBtns = document.querySelectorAll(".plot-tab-btn");
  plotTabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      plotTabBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const target = btn.getAttribute("data-plot-tab");
      const plots = ["linearFit", "concentrationTime", "residuals", "ordersComparison"];
      plots.forEach(p => {
        const div = document.getElementById(`${p}Plot`);
        if (div) div.style.display = p === target ? "block" : "none";
      });

      if (target === "linearFit") renderLinearFitPlot();
      if (target === "concentrationTime") renderConcentrationTimePlot();
      if (target === "residuals") renderResidualsPlot();
      if (target === "ordersComparison") renderOrdersComparisonPlot();

      const activeEl = document.getElementById(`${target}Plot`);
      if (activeEl) Plotly.Plots.resize(activeEl);
    });
  });

  // Re-render plots when theme changes
  window.addEventListener("themeChanged", () => {
    renderLinearFitPlot();
    renderConcentrationTimePlot();
    renderResidualsPlot();
    renderOrdersComparisonPlot();
  });

  // ---- 7. Prediction & Simulation Calculator ----
  const sandbox = document.querySelector(".prediction-sandbox");
  if (sandbox) {
    const n = sandbox.getAttribute("data-n");
    const k = sandbox.getAttribute("data-k");
    const C0 = sandbox.getAttribute("data-c0");

    document.querySelectorAll(".predict-btn").forEach(btn => {
      btn.addEventListener("click", async function () {
        const mode = btn.getAttribute("data-mode");
        const panel = btn.closest(".predict-panel");
        const input = panel.querySelector(".pred-input");
        const valDisplay = panel.querySelector(`[data-result="${mode}"]`);
        const subDisplay = panel.querySelector(`[data-sub="${mode}"]`);
        const fieldName = input.getAttribute("data-field");
        const userVal = input.value.trim();

        if (!userVal) {
          valDisplay.textContent = "Please enter a value";
          valDisplay.style.color = "var(--danger)";
          return;
        }

        valDisplay.textContent = "Calculating...";
        valDisplay.style.color = "var(--primary)";

        const formData = new FormData();
        formData.append("mode", mode);
        formData.append("n", n);
        formData.append("k", k);
        formData.append("C0", C0);
        formData.append(fieldName, userVal);

        try {
          const resp = await fetch(window.PREDICT_URL || "/predict", {
            method: "POST",
            body: formData
          });
          const data = await resp.json();

          if (data.ok) {
            valDisplay.textContent = `${data.label} = ${Number(data.value).toPrecision(5)} ${data.unit || ""}`;
            valDisplay.style.color = "var(--success)";
            if (data.conversion !== undefined) {
              subDisplay.textContent = `Fractional Conversion X_A = ${data.conversion}%`;
            } else {
              subDisplay.textContent = `Physically valid prediction`;
            }
          } else {
            valDisplay.textContent = data.error || "Calculation error";
            valDisplay.style.color = "var(--danger)";
            subDisplay.textContent = "Check input boundary constraints";
          }
        } catch (err) {
          valDisplay.textContent = "Server unreachable";
          valDisplay.style.color = "var(--danger)";
          subDisplay.textContent = "Try again";
        }
      });
    });
  }

  // ---- 8. Export Action Buttons ----
  const printReportBtn = document.getElementById("printReportBtn");
  if (printReportBtn) {
    printReportBtn.addEventListener("click", () => window.print());
  }

  const copyEquationBtn = document.getElementById("copyEquationBtn");
  if (copyEquationBtn) {
    copyEquationBtn.addEventListener("click", () => {
      const eq = result.final_rate_equation || "";
      navigator.clipboard.writeText(eq).then(() => {
        const origText = copyEquationBtn.innerHTML;
        copyEquationBtn.innerHTML = `<span>&#10004; Copied!</span>`;
        setTimeout(() => (copyEquationBtn.innerHTML = origText), 2000);
      });
    });
  }

  const exportDataCsvBtn = document.getElementById("exportDataCsvBtn");
  if (exportDataCsvBtn) {
    exportDataCsvBtn.addEventListener("click", () => {
      const orig = result.original_data;
      if (!orig || !orig.t) return;

      let csvContent = "data:text/csv;charset=utf-8,";
      if (orig.C_B) {
        csvContent += "Time,Concentration_A,Concentration_B\n";
        orig.t.forEach((t, i) => {
          csvContent += `${t},${orig.C_A[i]},${orig.C_B[i]}\n`;
        });
      } else {
        csvContent += "Time,Concentration\n";
        orig.t.forEach((t, i) => {
          csvContent += `${t},${orig.C[i]}\n`;
        });
      }

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `kinetics_results_${methodKey}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  }
})();

