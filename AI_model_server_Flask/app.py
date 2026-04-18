from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import numpy as np
import socket
from datetime import datetime, timezone
from threading import Lock
from werkzeug.exceptions import HTTPException

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

MODEL_PATH = "best_rf_model.pkl"
FEATURE_COUNT = 22

latest_lock = Lock()
latest_result = {
    "available": False,
    "message": "No prediction has been made yet.",
}

try:
    model = joblib.load(MODEL_PATH)
except Exception as exc:
    raise RuntimeError(f"Failed to load model '{MODEL_PATH}': {exc}") from exc


@app.route("/", methods=["GET"])
def home():
    return jsonify({"message": "Fraud detection API is running"})


@app.route("/latest", methods=["GET", "OPTIONS"])
def latest_prediction():
    if request.method == "OPTIONS":
        return jsonify({"message": "Preflight OK"}), 200

    with latest_lock:
        payload = dict(latest_result)

    return jsonify(payload), 200


@app.route("/predict", methods=["POST", "OPTIONS"])
def predict():
    if request.method == "OPTIONS":
        return jsonify({"message": "Preflight OK"}), 200

    data = request.get_json(silent=True)

    if data is None:
        return jsonify({"error": "Invalid or missing JSON body. Provide a JSON list of 22 features."}), 400

    # Backward-compatible input support for clients that send {"features": [...]}
    if isinstance(data, dict):
        data = data.get("features")

    if not isinstance(data, list):
        return jsonify({"error": "Request JSON must be a list of 22 numeric features."}), 400

    if len(data) != FEATURE_COUNT:
        return jsonify({"error": f"Expected {FEATURE_COUNT} features, received {len(data)}."}), 400

    try:
        features = np.array(data, dtype=float).reshape(1, -1)
    except (TypeError, ValueError):
        return jsonify({"error": "All 22 features must be numeric values."}), 400

    try:
        prediction = int(model.predict(features)[0])
    except Exception as exc:
        return jsonify({"error": f"Model prediction failed: {exc}"}), 500

    timestamp = datetime.now(timezone.utc).isoformat()

    if prediction == 1:
        response_payload = {
            "prediction": 1,
            "status": "Fraud Detected",
            "type": "High Risk Pattern",
        }
    else:
        response_payload = {
            "prediction": 0,
            "status": "Safe",
            "type": "Normal Transaction",
        }

    with latest_lock:
        latest_result.clear()
        latest_result.update(
            {
                "available": True,
                "timestamp": timestamp,
                **response_payload,
            }
        )

    return jsonify(response_payload)


@app.errorhandler(Exception)
def handle_global_error(error):
    if isinstance(error, HTTPException):
        return jsonify({"error": error.description}), error.code

    # Avoid crashing the server on unexpected inputs/errors during demo usage.
    return jsonify({"error": "Unexpected server error. Please retry."}), 500


def get_local_ipv4_addresses():
    addresses = set()
    hostname = socket.gethostname()

    try:
        for info in socket.getaddrinfo(hostname, None, socket.AF_INET):
            ip = info[4][0]
            if not ip.startswith("127."):
                addresses.add(ip)
    except socket.gaierror:
        pass

    return sorted(addresses)


if __name__ == "__main__":
    print("ML Server Live - Listening at:")
    print("- http://127.0.0.1:5000")
    for ip in get_local_ipv4_addresses():
        print(f"- http://{ip}:5000")
    app.run(host="0.0.0.0", port=5000, threaded=True)
