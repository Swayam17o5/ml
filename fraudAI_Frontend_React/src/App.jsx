import { useMemo, useState } from "react";

const FEATURE_NAMES = [
  "Transaction Amount",
  "Transaction Frequency",
  "Recipient Blacklist Status",
  "Device Fingerprinting",
  "VPN or Proxy Usage",
  "Behavioral Biometrics",
  "Time Since Last Transaction",
  "Social Trust Score",
  "Account Age",
  "High-Risk Transaction Times",
  "Past Fraudulent Behavior Flags",
  "Location-Inconsistent Transactions",
  "Normalized Transaction Amount",
  "Transaction Context Anomalies",
  "Fraud Complaints Count",
  "Merchant Category Mismatch",
  "User Daily Limit Exceeded",
  "Recent High-Value Transaction Flags",
  "Recipient Verification Status_suspicious",
  "Recipient Verification Status_verified",
  "Geo-Location Flags_normal",
  "Geo-Location Flags_unusual",
];

const NOT_FRAUD_SAMPLE = [
  0.0077721980079471205,
  0.46153846153846156,
  0.0,
  0.0,
  0.0,
  0.11908418421807722,
  0.7942634013278564,
  0.17217382428507993,
  0.7869361310365848,
  0.0,
  0.0,
  0.0,
  0.41400308521923995,
  0.1869060352964757,
  0.0,
  0.0,
  0.0,
  0.0,
  0.0,
  1.0,
  1.0,
  0.0,
];

const FRAUD_SAMPLE = [
  0.0079769523,
  0.0,
  1.0,
  0.0,
  1.0,
  0.1892930732,
  0.2897591761,
  0.8752220188,
  0.0329058891,
  0.0,
  0.0,
  0.0,
  0.5557675537,
  0.15793259,
  0.0,
  0.0,
  0.0,
  0.0,
  0.0,
  1.0,
  0.0,
  0.0,
];

const LABEL_HEADER_KEYS = new Set([
  "label",
  "truelabel",
  "trueclass",
  "target",
  "isfraud",
  "fraudlabel",
]);

function normalizeKey(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function splitCsvLine(line) {
  return line.split(",").map((cell) => cell.trim());
}

function parseLabelCell(rawValue, rowNumber) {
  if (rawValue === undefined || rawValue === "") {
    return null;
  }

  const numericValue = Number(rawValue);
  if (Number.isNaN(numericValue) || (numericValue !== 0 && numericValue !== 1)) {
    throw new Error(`Row ${rowNumber}: label must be 0 or 1.`);
  }

  return numericValue;
}

function parseCsvText(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    throw new Error("Uploaded file is empty.");
  }

  const firstCells = splitCsvLine(lines[0]);
  const hasHeader = firstCells.some((cell) => Number.isNaN(Number(cell)));
  const rows = [];

  if (hasHeader) {
    const headerIndexMap = new Map();
    firstCells.forEach((header, index) => {
      headerIndexMap.set(normalizeKey(header), index);
    });

    const featureIndices = FEATURE_NAMES.map((name) => {
      const index = headerIndexMap.get(normalizeKey(name));
      if (index === undefined) {
        throw new Error(`Missing required column: ${name}`);
      }
      return index;
    });

    let labelIndex = null;
    for (const [key, index] of headerIndexMap.entries()) {
      if (LABEL_HEADER_KEYS.has(key)) {
        labelIndex = index;
        break;
      }
    }

    for (let i = 1; i < lines.length; i += 1) {
      const rowNumber = i + 1;
      const cells = splitCsvLine(lines[i]);
      const features = featureIndices.map((columnIndex, featureIndex) => {
        const numericValue = Number(cells[columnIndex]);
        if (Number.isNaN(numericValue)) {
          throw new Error(
            `Row ${rowNumber}: invalid numeric value for ${FEATURE_NAMES[featureIndex]}.`
          );
        }
        return numericValue;
      });

      const trueLabel = labelIndex === null ? null : parseLabelCell(cells[labelIndex], rowNumber);
      rows.push({ rowNumber, features, trueLabel });
    }
  } else {
    for (let i = 0; i < lines.length; i += 1) {
      const rowNumber = i + 1;
      const cells = splitCsvLine(lines[i]);

      if (cells.length !== FEATURE_NAMES.length && cells.length !== FEATURE_NAMES.length + 1) {
        throw new Error(
          `Row ${rowNumber}: expected 22 features or 22 features + label, received ${cells.length}.`
        );
      }

      const features = cells.slice(0, FEATURE_NAMES.length).map((cell, featureIndex) => {
        const numericValue = Number(cell);
        if (Number.isNaN(numericValue)) {
          throw new Error(
            `Row ${rowNumber}: invalid numeric value for ${FEATURE_NAMES[featureIndex]}.`
          );
        }
        return numericValue;
      });

      const trueLabel =
        cells.length === FEATURE_NAMES.length + 1
          ? parseLabelCell(cells[FEATURE_NAMES.length], rowNumber)
          : null;

      rows.push({ rowNumber, features, trueLabel });
    }
  }

  if (rows.length === 0) {
    throw new Error("No data rows found in uploaded file.");
  }

  return {
    rows,
    hasHeader,
    hasLabels: rows.some((row) => row.trueLabel !== null),
  };
}

function App() {
  const [baseUrl, setBaseUrl] = useState("http://127.0.0.1:5000");
  const [healthMessage, setHealthMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [uploadMessage, setUploadMessage] = useState("");
  const [fileName, setFileName] = useState("");
  const [uploadedRows, setUploadedRows] = useState([]);
  const [predictionRows, setPredictionRows] = useState([]);
  const [isPredicting, setIsPredicting] = useState(false);

  const stats = useMemo(() => {
    const validPredictions = predictionRows.filter((row) => row.error === null);
    const labeledPredictions = validPredictions.filter((row) => row.trueLabel !== null);
    const fraudCount = validPredictions.filter((row) => row.predictedClass === 1).length;

    const metrics = {
      total: labeledPredictions.length,
      correct: 0,
      tp: 0,
      tn: 0,
      fp: 0,
      fn: 0,
    };

    labeledPredictions.forEach((row) => {
      if (row.isCorrect) {
        metrics.correct += 1;
      }
      if (row.trueLabel === 1 && row.predictedClass === 1) metrics.tp += 1;
      if (row.trueLabel === 0 && row.predictedClass === 0) metrics.tn += 1;
      if (row.trueLabel === 0 && row.predictedClass === 1) metrics.fp += 1;
      if (row.trueLabel === 1 && row.predictedClass === 0) metrics.fn += 1;
    });

    const accuracy =
      metrics.total > 0 ? ((metrics.correct / metrics.total) * 100).toFixed(2) : "0.00";

    return {
      totalPredicted: validPredictions.length,
      totalErrors: predictionRows.filter((row) => row.error !== null).length,
      fraudCount,
      nonFraudCount: validPredictions.length - fraudCount,
      metrics,
      accuracy,
    };
  }, [predictionRows]);

  function clearMessages() {
    setErrorMessage("");
    setUploadMessage("");
  }

  async function runHealthCheck() {
    clearMessages();

    try {
      const response = await fetch(`${baseUrl}/`);
      const text = await response.text();
      setHealthMessage(`HTTP ${response.status}: ${text}`);
    } catch (error) {
      setHealthMessage("");
      setErrorMessage(`Health check failed: ${String(error.message || error)}`);
    }
  }

  async function handleFileUpload(event) {
    clearMessages();
    setPredictionRows([]);

    const selectedFile = event.target.files?.[0];
    if (!selectedFile) {
      return;
    }

    try {
      const text = await selectedFile.text();
      const parsed = parseCsvText(text);
      setUploadedRows(parsed.rows);
      setFileName(selectedFile.name);
      setUploadMessage(
        `Loaded ${parsed.rows.length} rows from ${selectedFile.name}. ` +
          `${parsed.hasHeader ? "Header detected." : "No header detected."} ` +
          `${parsed.hasLabels ? "Label column detected." : "No label column detected."}`
      );
    } catch (error) {
      setUploadedRows([]);
      setFileName("");
      setErrorMessage(`File parsing failed: ${String(error.message || error)}`);
    }
  }

  async function runBatchPrediction() {
    clearMessages();

    if (uploadedRows.length === 0) {
      setErrorMessage("Upload a CSV file first.");
      return;
    }

    setIsPredicting(true);
    const nextPredictions = [];

    for (const row of uploadedRows) {
      try {
        const response = await fetch(`${baseUrl}/predict`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(row.features),
        });

        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || `HTTP ${response.status}`);
        }

        const rawPrediction = Array.isArray(payload.prediction)
          ? payload.prediction[0]
          : payload.prediction;
        const predictedClass = Number(rawPrediction) >= 0.5 ? 1 : 0;
        const predictedLabel = predictedClass === 1 ? "Fraud" : "Not Fraud";
        const isCorrect = row.trueLabel === null ? null : row.trueLabel === predictedClass;

        nextPredictions.push({
          rowNumber: row.rowNumber,
          predictedClass,
          predictedLabel,
          rawPrediction,
          trueLabel: row.trueLabel,
          isCorrect,
          error: null,
        });
      } catch (error) {
        nextPredictions.push({
          rowNumber: row.rowNumber,
          predictedClass: null,
          predictedLabel: "-",
          rawPrediction: "-",
          trueLabel: row.trueLabel,
          isCorrect: null,
          error: String(error.message || error),
        });
      }
    }

    setPredictionRows(nextPredictions);
    setIsPredicting(false);
  }

  function downloadTemplateCsv() {
    const header = [...FEATURE_NAMES, "Label"].join(",");
    const row1 = [...NOT_FRAUD_SAMPLE, 0].join(",");
    const row2 = [...FRAUD_SAMPLE, 1].join(",");
    const csv = `${header}\n${row1}\n${row2}\n`;

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "model_input_template.csv";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0b1220",
        color: "#e5e7eb",
        fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif",
        padding: "24px",
      }}
    >
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <h1 style={{ margin: 0, fontSize: "28px" }}>CSV Upload Fraud Predictor</h1>
        <p style={{ opacity: 0.9, marginTop: "8px" }}>
          Upload unseen data as CSV and the model will predict Fraud/Not Fraud for each row.
        </p>

        <section style={panelStyle}>
          <label style={{ display: "block", marginBottom: "8px" }}>Backend URL</label>
          <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} style={inputStyle} />
          <div style={{ marginTop: "12px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button onClick={runHealthCheck} style={buttonStyle}>
              Check Backend Health
            </button>
          </div>
          {healthMessage ? <p style={{ marginTop: "12px", color: "#86efac" }}>{healthMessage}</p> : null}
        </section>

        <section style={panelStyle}>
          <h2 style={{ marginTop: 0, fontSize: "20px" }}>Upload Unseen Data</h2>
          <p style={{ marginTop: "6px", opacity: 0.9 }}>
            Supported formats:
          </p>
          <p style={{ marginTop: "6px", opacity: 0.9 }}>
            1. Header CSV containing all 22 required feature columns (optional label column).
          </p>
          <p style={{ marginTop: "6px", opacity: 0.9 }}>
            2. No-header CSV with 22 values per row (or 23 if last value is label 0/1).
          </p>

          <div style={{ marginTop: "12px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button onClick={downloadTemplateCsv} style={secondaryButtonStyle}>
              Download CSV Template
            </button>
            <label style={{ ...secondaryButtonStyle, display: "inline-flex", alignItems: "center" }}>
              Choose CSV File
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileUpload}
                style={{ display: "none" }}
              />
            </label>
            <button onClick={runBatchPrediction} style={buttonStyle} disabled={isPredicting}>
              {isPredicting ? "Predicting..." : "Predict Uploaded Data"}
            </button>
          </div>

          {fileName ? <p style={{ marginTop: "10px", color: "#93c5fd" }}>Selected file: {fileName}</p> : null}
          {uploadMessage ? <p style={{ marginTop: "8px", color: "#86efac" }}>{uploadMessage}</p> : null}
          {errorMessage ? <p style={{ marginTop: "8px", color: "#fca5a5" }}>{errorMessage}</p> : null}
        </section>

        <section style={panelStyle}>
          <h2 style={{ marginTop: 0, fontSize: "20px" }}>Prediction Summary</h2>
          <p style={{ margin: "6px 0" }}>Rows predicted: {stats.totalPredicted}</p>
          <p style={{ margin: "6px 0" }}>Predicted Fraud: {stats.fraudCount}</p>
          <p style={{ margin: "6px 0" }}>Predicted Not Fraud: {stats.nonFraudCount}</p>
          <p style={{ margin: "6px 0" }}>Row errors: {stats.totalErrors}</p>
          <p style={{ margin: "6px 0" }}>Labeled rows evaluated: {stats.metrics.total}</p>
          <p style={{ margin: "6px 0" }}>Accuracy (labeled rows): {stats.accuracy}%</p>
          <p style={{ margin: "6px 0" }}>
            TP: {stats.metrics.tp} | TN: {stats.metrics.tn} | FP: {stats.metrics.fp} | FN: {stats.metrics.fn}
          </p>
        </section>

        <section style={panelStyle}>
          <h2 style={{ marginTop: 0, fontSize: "20px" }}>Row-wise Results</h2>
          {predictionRows.length === 0 ? (
            <p style={{ opacity: 0.85 }}>No predictions yet.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "760px" }}>
                <thead>
                  <tr>
                    <th style={cellHeaderStyle}>Row</th>
                    <th style={cellHeaderStyle}>Prediction</th>
                    <th style={cellHeaderStyle}>Raw</th>
                    <th style={cellHeaderStyle}>True Label</th>
                    <th style={cellHeaderStyle}>Correct?</th>
                    <th style={cellHeaderStyle}>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {predictionRows.map((row) => (
                    <tr key={row.rowNumber}>
                      <td style={cellStyle}>{row.rowNumber}</td>
                      <td style={cellStyle}>{row.predictedLabel}</td>
                      <td style={cellStyle}>{row.rawPrediction}</td>
                      <td style={cellStyle}>{row.trueLabel === null ? "-" : row.trueLabel}</td>
                      <td style={cellStyle}>
                        {row.isCorrect === null ? "-" : row.isCorrect ? "Yes" : "No"}
                      </td>
                      <td style={{ ...cellStyle, color: row.error ? "#fca5a5" : "#93c5fd" }}>
                        {row.error || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

const panelStyle = {
  marginTop: "20px",
  padding: "16px",
  background: "#111a2e",
  borderRadius: "12px",
  border: "1px solid #22314f",
};

const inputStyle = {
  width: "100%",
  padding: "10px",
  borderRadius: "8px",
  border: "1px solid #334155",
  background: "#0f172a",
  color: "#e5e7eb",
};

const buttonStyle = {
  padding: "10px 14px",
  borderRadius: "8px",
  border: "1px solid #334155",
  background: "#1d4ed8",
  color: "white",
  cursor: "pointer",
};

const secondaryButtonStyle = {
  ...buttonStyle,
  background: "#1f2937",
};

const cellHeaderStyle = {
  textAlign: "left",
  padding: "10px",
  borderBottom: "1px solid #334155",
  fontWeight: 600,
};

const cellStyle = {
  padding: "10px",
  borderBottom: "1px solid #22314f",
};

export default App;
