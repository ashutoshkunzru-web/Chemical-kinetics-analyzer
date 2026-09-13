// Chemical Reaction Kinetics Analyzer -- Modern Interactive Frontend Logic

document.addEventListener("DOMContentLoaded", function () {
  // ---- 1. Theme Management (Light / Dark) ----
  const themeToggle = document.getElementById("themeToggle");
  const storedTheme = localStorage.getItem("kinetics_theme") || "light";
  document.documentElement.setAttribute("data-theme", storedTheme);

  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme") || "light";
      const nextTheme = current === "light" ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", nextTheme);
      localStorage.setItem("kinetics_theme", nextTheme);
      
      // Dispatch event for Plotly graphs to update colors if on results page
      window.dispatchEvent(new CustomEvent("themeChanged", { detail: { theme: nextTheme } }));
    });
  }

  // ---- 2. Guide & Help Modal ----
  const helpModalBtn = document.getElementById("helpModalBtn");
  const helpModal = document.getElementById("helpModal");
  const helpModalClose = document.getElementById("helpModalClose");

  if (helpModalBtn && helpModal) {
    helpModalBtn.addEventListener("click", () => {
      helpModal.style.display = "flex";
      if (window.renderMathInElement) {
        window.renderMathInElement(helpModal, {
          delimiters: [
            { left: "$$", right: "$$", display: true },
            { left: "$", right: "$", display: false }
          ]
        });
      }
    });

    if (helpModalClose) {
      helpModalClose.addEventListener("click", () => helpModal.style.display = "none");
    }

    helpModal.addEventListener("click", (e) => {
      if (e.target === helpModal) helpModal.style.display = "none";
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && helpModal.style.display === "flex") {
        helpModal.style.display = "none";
      }
    });
  }

  // ---- Index Page Form Interactions ----
  const form = document.getElementById("analyzeForm");
  if (!form) return; // Not on the input index page

  const methodInput = document.getElementById("selectedMethodInput");
  const methodCards = document.querySelectorAll(".method-option-card");
  const tableBody = document.getElementById("dataTableBody");
  const addRowBtn = document.getElementById("addRowBtn");
  const clearTableBtn = document.getElementById("clearTableBtn");
  const sortByTimeBtn = document.getElementById("sortByTimeBtn");
  const rowCountDisplay = document.getElementById("rowCountDisplay");
  const reversibleExtraSection = document.getElementById("reversibleExtraSection");
  const cAeInput = document.getElementById("c_ae");
  const dataStepNum = document.getElementById("dataStepNum");
  const dataJsonInput = document.getElementById("dataJson");
  const loadingIndicator = document.getElementById("loadingIndicator");
  const analyzeBtn = document.getElementById("analyzeBtn");
  const downloadSampleCsvLink = document.getElementById("downloadSampleCsvLink");
  const csvFileInput = document.getElementById("csv_file");
  const csvDropzone = document.getElementById("csvDropzone");
  const dropzoneFilename = document.getElementById("dropzoneFilename");

  // Initial default dataset for standard first-order decay
  const DEFAULT_INITIAL_DATA = [
    { t: "0", C: "10.00" },
    { t: "5", C: "7.79" },
    { t: "10", C: "6.07" },
    { t: "15", C: "4.72" },
    { t: "20", C: "3.68" },
    { t: "30", C: "2.23" },
    { t: "40", C: "1.35" },
    { t: "50", C: "0.82" },
    { t: "60", C: "0.50" }
  ];

  // ---- Helper: Update Row Count Display ----
  function updateRowCount() {
    if (!tableBody || !rowCountDisplay) return;
    const count = tableBody.querySelectorAll("tr").length;
    rowCountDisplay.textContent = `${count} data point${count === 1 ? "" : "s"} entered`;
    // Update numbering cells
    tableBody.querySelectorAll("tr").forEach((tr, index) => {
      const numCell = tr.querySelector(".row-index");
      if (numCell) numCell.textContent = index + 1;
    });
  }

  // ---- Helper: Build a Data Row Element ----
  function createRowElement(t = "", C = "", cb = "") {
    const tr = document.createElement("tr");
    const currentMethod = methodInput ? methodInput.value : "integral";
    const isAutocatalytic = currentMethod === "autocatalytic";

    tr.innerHTML = `
      <td class="row-index" style="color: var(--text-subtle); font-size: 0.8rem; text-align: center;">1</td>
      <td>
        <input type="number" step="any" class="cell-t" value="${t}" placeholder="t" required>
      </td>
      <td>
        <input type="number" step="any" class="cell-c" value="${C}" placeholder="C_A" required>
      </td>
      <td class="col-cb cb-cell" style="display: ${isAutocatalytic ? "" : "none"};">
        <input type="number" step="any" class="cell-cb" value="${cb}" placeholder="C_B">
      </td>
      <td style="text-align: center;">
        <button type="button" class="btn-icon-danger remove-row-btn" title="Remove point">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </td>
    `;

    tr.querySelector(".remove-row-btn").addEventListener("click", () => {
      tr.remove();
      updateRowCount();
    });

    return tr;
  }

  // ---- Load Array of Rows into Table ----
  function populateTable(rows, cbValues = null) {
    tableBody.innerHTML = "";
    rows.forEach((r, i) => {
      const cbVal = cbValues && cbValues[i] !== undefined ? cbValues[i] : (r.C_B || "");
      tableBody.appendChild(createRowElement(r.t, r.C, cbVal));
    });
    updateRowCount();
  }

  // Seed default data on load
  populateTable(DEFAULT_INITIAL_DATA);

  // Add row button
  if (addRowBtn) {
    addRowBtn.addEventListener("click", () => {
      const rows = tableBody.querySelectorAll("tr");
      let nextT = "";
      if (rows.length > 0) {
        const lastT = parseFloat(rows[rows.length - 1].querySelector(".cell-t").value);
        if (!isNaN(lastT)) nextT = (lastT + 10).toString();
      }
      tableBody.appendChild(createRowElement(nextT, ""));
      updateRowCount();
    });
  }

  // Clear rows button
  if (clearTableBtn) {
    clearTableBtn.addEventListener("click", () => {
      if (confirm("Clear all data points from the table?")) {
        tableBody.innerHTML = "";
        updateRowCount();
      }
    });
  }

  // Sort by time button
  if (sortByTimeBtn) {
    sortByTimeBtn.addEventListener("click", () => {
      const rows = Array.from(tableBody.querySelectorAll("tr"));
      rows.sort((a, b) => {
        const tA = parseFloat(a.querySelector(".cell-t").value) || 0;
        const tB = parseFloat(b.querySelector(".cell-t").value) || 0;
        return tA - tB;
      });
      tableBody.innerHTML = "";
      rows.forEach(r => tableBody.appendChild(r));
      updateRowCount();
    });
  }

  // ---- 3. Method Selection Handling ----
  function setMethod(methodKey) {
    if (!methodInput) return;
    methodInput.value = methodKey;

    methodCards.forEach(card => {
      card.classList.toggle("active", card.getAttribute("data-method-val") === methodKey);
    });

    // Toggle autocatalytic column
    const isAutocatalytic = methodKey === "autocatalytic";
    document.querySelectorAll(".col-cb").forEach(el => {
      el.style.display = isAutocatalytic ? "" : "none";
    });
    document.querySelectorAll(".cb-hint").forEach(el => {
      el.style.display = isAutocatalytic ? "" : "none";
    });

    // Toggle reversible extra parameter
    const isReversible = methodKey === "reversible";
    if (reversibleExtraSection) {
      reversibleExtraSection.style.display = isReversible ? "" : "none";
    }
    if (dataStepNum) {
      dataStepNum.textContent = isReversible ? "3" : "2";
    }

    // Update download sample CSV link
    if (downloadSampleCsvLink) {
      downloadSampleCsvLink.href = `/download-sample-csv/${methodKey}`;
    }

    // Re-render math if KaTeX is loaded
    if (window.renderMathInElement) {
      window.renderMathInElement(document.body, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "$", right: "$", display: false }
        ]
      });
    }
  }

  methodCards.forEach(card => {
    card.addEventListener("click", () => {
      const methodKey = card.getAttribute("data-method-val");
      setMethod(methodKey);
    });
  });

  // ---- 4. 1-Click Preset Dataset Loader ----
  const presetButtons = document.querySelectorAll(".btn-preset");
  presetButtons.forEach(btn => {
    btn.addEventListener("click", async () => {
      const methodKey = btn.getAttribute("data-preset");
      btn.disabled = true;

      try {
        const response = await fetch(`/sample-data/${methodKey}`);
        const result = await response.json();
        if (result.ok && result.data) {
          setMethod(methodKey);
          populateTable(result.data.rows);
          if (cAeInput && result.data.c_ae) {
            cAeInput.value = result.data.c_ae;
          }
          
          presetButtons.forEach(b => b.classList.remove("active"));
          btn.classList.add("active");
        }
      } catch (err) {
        console.error("Failed to load sample dataset:", err);
      } finally {
        btn.disabled = false;
      }
    });
  });

  // ---- 5. Spreadsheet Excel / Sheets Clipboard Paste ----
  if (tableBody) {
    tableBody.addEventListener("paste", (e) => {
      const clipboardData = (e.clipboardData || window.clipboardData).getData("text");
      if (!clipboardData || (!clipboardData.includes("\t") && !clipboardData.includes(",") && !clipboardData.includes("\n"))) {
        return; // standard single-field paste
      }

      e.preventDefault();
      const lines = clipboardData.trim().split(/\r\n|\n|\r/);
      const parsedRows = [];

      lines.forEach(line => {
        if (!line.trim()) return;
        // Check for tab or comma delimiter
        const delimiter = line.includes("\t") ? "\t" : ",";
        const parts = line.split(delimiter).map(p => p.trim());
        if (parts.length >= 2) {
          const t = parseFloat(parts[0]);
          const c = parseFloat(parts[1]);
          if (!isNaN(t) && !isNaN(c)) {
            const row = { t: parts[0], C: parts[1] };
            if (parts.length >= 3 && !isNaN(parseFloat(parts[2]))) {
              row.C_B = parts[2];
            }
            parsedRows.push(row);
          }
        }
      });

      if (parsedRows.length > 0) {
        populateTable(parsedRows);
      }
    });
  }

  // ---- 6. Input Mode Tabs (Table vs CSV) ----
  const tabButtons = document.querySelectorAll(".tab-btn");
  const tabPanels = document.querySelectorAll(".tab-panel");

  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      tabButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const targetTab = btn.getAttribute("data-tab");
      tabPanels.forEach(p => {
        p.style.display = p.getAttribute("data-panel") === targetTab ? "" : "none";
      });
    });
  });

  // ---- 7. Drag-and-Drop CSV Upload ----
  if (csvDropzone && csvFileInput) {
    csvDropzone.addEventListener("click", () => csvFileInput.click());

    csvDropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      csvDropzone.classList.add("dragover");
    });

    csvDropzone.addEventListener("dragleave", () => {
      csvDropzone.classList.remove("dragover");
    });

    csvDropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      csvDropzone.classList.remove("dragover");
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        csvFileInput.files = e.dataTransfer.files;
        handleCsvFileSelected(e.dataTransfer.files[0]);
      }
    });

    csvFileInput.addEventListener("change", () => {
      if (csvFileInput.files && csvFileInput.files.length > 0) {
        handleCsvFileSelected(csvFileInput.files[0]);
      }
    });

    function handleCsvFileSelected(file) {
      if (dropzoneFilename) {
        dropzoneFilename.innerHTML = `<strong>Selected file:</strong> ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
      }

      // Live parse file into table as well for immediate user preview & edits
      const reader = new FileReader();
      reader.onload = function (evt) {
        const text = evt.target.result;
        const lines = text.trim().split(/\r\n|\n|\r/);
        if (lines.length > 1) {
          const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
          const tIdx = headers.findIndex(h => h.includes("time") || h === "t");
          const cIdx = headers.findIndex(h => h.includes("conc") || h === "c" || h === "c_a");
          const cbIdx = headers.findIndex(h => h.includes("concb") || h.includes("c_b") || h === "cb");

          const parsedRows = [];
          for (let i = 1; i < lines.length; i++) {
            const parts = lines[i].split(",").map(p => p.trim());
            if (parts.length >= 2) {
              const tVal = tIdx >= 0 ? parts[tIdx] : parts[0];
              const cVal = cIdx >= 0 ? parts[cIdx] : parts[1];
              if (!isNaN(parseFloat(tVal)) && !isNaN(parseFloat(cVal))) {
                const r = { t: tVal, C: cVal };
                if (cbIdx >= 0 && parts[cbIdx]) {
                  r.C_B = parts[cbIdx];
                }
                parsedRows.push(r);
              }
            }
          }

          if (parsedRows.length >= 3) {
            populateTable(parsedRows);
            if (parsedRows[0].C_B) {
              setMethod("autocatalytic");
            }
          }
        }
      };
      reader.readAsText(file);
    }
  }

  // ---- 8. Form Submit & Validation ----
  form.addEventListener("submit", function (e) {
    const csvHasFile = csvFileInput && csvFileInput.files && csvFileInput.files.length > 0;
    const manualTabActive = document.querySelector('.tab-btn[data-tab="manual"]').classList.contains("active");

    if (manualTabActive || !csvHasFile) {
      // Clear file input if submitting manual table
      if (csvFileInput && manualTabActive) csvFileInput.value = "";

      const rows = [];
      const trs = tableBody.querySelectorAll("tr");

      trs.forEach(tr => {
        const tVal = tr.querySelector(".cell-t").value.trim();
        const cVal = tr.querySelector(".cell-c").value.trim();
        const cbInput = tr.querySelector(".cell-cb");

        if (tVal !== "" && cVal !== "") {
          const row = { t: tVal, C: cVal };
          if (methodInput.value === "autocatalytic" && cbInput && cbInput.value.trim() !== "") {
            row.C_B = cbInput.value.trim();
          }
          rows.push(row);
        }
      });

      if (rows.length < 3) {
        e.preventDefault();
        alert("Please enter at least 3 valid experimental data points (Time and Concentration) before running analysis.");
        return;
      }

      dataJsonInput.value = JSON.stringify(rows);
    }

    if (loadingIndicator) loadingIndicator.style.display = "inline-flex";
    if (analyzeBtn) {
      analyzeBtn.disabled = true;
      analyzeBtn.style.opacity = "0.7";
    }
  });
});

