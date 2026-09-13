// Chemical Reaction Kinetics Analyzer -- input page behaviour

document.addEventListener("DOMContentLoaded", function () {
  const methodSelect = document.getElementById("method");
  const tableBody = document.getElementById("dataTableBody");
  const addRowBtn = document.getElementById("addRowBtn");
  const form = document.getElementById("analyzeForm");
  const dataJsonInput = document.getElementById("dataJson");
  const loadingIndicator = document.getElementById("loadingIndicator");
  const reversibleExtra = document.getElementById("reversibleExtra");
  const cbHint = document.querySelector(".cb-hint");

  if (!form) return; // not on the index page

  const DEFAULT_ROWS = [
    { t: "0", C: "10" },
    { t: "20", C: "8" },
    { t: "40", C: "6" },
    { t: "60", C: "5" },
  ];

  function showCbColumn(show) {
    document.querySelectorAll(".col-cb").forEach((el) => {
      el.style.display = show ? "" : "none";
    });
    document.querySelectorAll(".cb-cell").forEach((el) => {
      el.style.display = show ? "" : "none";
    });
    if (cbHint) cbHint.style.display = show ? "" : "none";
  }

  function makeRow(t, C, cb) {
    const tr = document.createElement("tr");

    const tTd = document.createElement("td");
    const tInput = document.createElement("input");
    tInput.type = "number";
    tInput.step = "any";
    tInput.className = "cell-t";
    tInput.value = t !== undefined ? t : "";
    tTd.appendChild(tInput);

    const cTd = document.createElement("td");
    const cInput = document.createElement("input");
    cInput.type = "number";
    cInput.step = "any";
    cInput.className = "cell-c";
    cInput.value = C !== undefined ? C : "";
    cTd.appendChild(cInput);

    const cbTd = document.createElement("td");
    cbTd.className = "col-cb cb-cell";
    cbTd.style.display = methodSelect.value === "autocatalytic" ? "" : "none";
    const cbInput = document.createElement("input");
    cbInput.type = "number";
    cbInput.step = "any";
    cbInput.className = "cell-cb";
    cbInput.value = cb !== undefined ? cb : "";
    cbTd.appendChild(cbInput);

    const actionTd = document.createElement("td");
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "remove-row-btn";
    removeBtn.innerHTML = "&times;";
    removeBtn.title = "Remove row";
    removeBtn.addEventListener("click", () => tr.remove());
    actionTd.appendChild(removeBtn);

    tr.appendChild(tTd);
    tr.appendChild(cTd);
    tr.appendChild(cbTd);
    tr.appendChild(actionTd);
    return tr;
  }

  function seedDefaultRows() {
    tableBody.innerHTML = "";
    DEFAULT_ROWS.forEach((r) => tableBody.appendChild(makeRow(r.t, r.C)));
  }

  seedDefaultRows();

  addRowBtn.addEventListener("click", () => {
    tableBody.appendChild(makeRow());
  });

  // ---- method switching ----
  function updateMethodUI() {
    const method = methodSelect.value;
    document.querySelectorAll("[data-method-note]").forEach((el) => {
      el.classList.toggle("active", el.getAttribute("data-method-note") === method);
    });
    showCbColumn(method === "autocatalytic");
    reversibleExtra.style.display = method === "reversible" ? "" : "none";
    document.getElementById("dataSectionTitle").textContent =
      method === "reversible" ? "3. Enter your data" : "2. Enter your data";
  }
  methodSelect.addEventListener("change", updateMethodUI);
  updateMethodUI();

  // ---- tabs (manual vs CSV) ----
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const tab = btn.getAttribute("data-tab");
      document.querySelectorAll(".tab-panel").forEach((panel) => {
        panel.style.display = panel.getAttribute("data-panel") === tab ? "" : "none";
      });
    });
  });

  // ---- submit: collect manual table into JSON ----
  form.addEventListener("submit", function (e) {
    const csvInput = document.getElementById("csv_file");
    const usingCsv = csvInput && csvInput.files && csvInput.files.length > 0;

    if (!usingCsv) {
      const rows = [];
      tableBody.querySelectorAll("tr").forEach((tr) => {
        const t = tr.querySelector(".cell-t").value;
        const C = tr.querySelector(".cell-c").value;
        const cbCell = tr.querySelector(".cell-cb");
        const row = { t, C };
        if (methodSelect.value === "autocatalytic" && cbCell) {
          row.C_B = cbCell.value;
        }
        rows.push(row);
      });
      dataJsonInput.value = JSON.stringify(rows);
    } else {
      dataJsonInput.value = "";
    }

    loadingIndicator.style.display = "inline";
    document.getElementById("analyzeBtn").disabled = true;
  });
});
