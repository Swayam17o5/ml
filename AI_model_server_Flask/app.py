import os
import joblib
from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
import socket
import requests
import time
import json
import threading
from datetime import datetime, timezone

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

# --- Configuration ---
FEATURE_COUNT = 22
latest_lock = threading.Lock()
latest_result = {"available": False}

# --- Hugging Face Integration ---
HF_SPACE_URL = "https://swayam17o5-fraud-detection-api.hf.space"
HF_API_ENDPOINT = f"{HF_SPACE_URL}/gradio_api/call/predict"

# --- UPI Fraud Pattern Definitions (Problem Statement 4) ---
SCAM_PATTERNS = {
    "KYC_EXPIRY": "KYC Expiry Scam",
    "SCREEN_SHARE": "Screen Share Scam",
    "COLLECT_REQUEST": "Collect Request Fraud",
    "FAKE_CARE": "Fake Customer Care",
    "QR_CODE": "QR Code Scam",
    "LOTTERY": "Lottery/Prize Scam",
    "JOB_OFFER": "Job Offer Fraud",
    "ROMANCE": "Romance Scam",
    "IMPERSONATION": "Impersonation Fraud",
    "REFUND": "Refund Fraud"
}

def identify_scam_pattern(f):
    """
    Analyzes the 22-feature vector to identify a specific fraud pattern.
    f is a list of 22 numerical features.
    """
    # Pattern 1: Screen Share Scam (Feature 21 used as Screen Rec bit in demo)
    if f[21] > 0.5 and f[15] > 0.5:
        return SCAM_PATTERNS["SCREEN_SHARE"]
        
    # Pattern 2: KYC Expiry (New Recip + Late Hour + Amount Anomaly)
    if f[6] > 0.8 and (f[7] < 0.25 or f[7] > 0.85) and f[1] > 0.6:
        return SCAM_PATTERNS["KYC_EXPIRY"]
        
    # Pattern 3: Collect Request Fraud (Merchant Risk + Behavioral)
    if f[10] > 0.7 and f[5] > 0.7:
        return SCAM_PATTERNS["COLLECT_REQUEST"]
        
    # Pattern 4: SIM Swap (New Device + Velocity + IP Anomaly)
    if f[4] < 0.3 and f[8] > 0.7 and f[17] > 0.5:
        return "SIM Swap Scam"
        
    # Pattern 5: QR Code Swap (External Link + Merchant Risk)
    if f[10] > 0.8 and f[20] > 0.6:
        return SCAM_PATTERNS["QR_CODE"]
        
    # Pattern 6: Prize/Lottery (Extreme Amount Anomaly + New Recip)
    if f[1] > 0.9 and f[6] > 0.8:
        return SCAM_PATTERNS["LOTTERY"]
        
    # Pattern 7: Fake Customer Care (VoIP/VPN + Velocity)
    if f[3] > 0.8 and f[8] > 0.6:
        return SCAM_PATTERNS["FAKE_CARE"]
        
    # Pattern 8: Money Mule Chain (High Velocity + IP Reputation)
    if f[8] > 0.9 and f[9] < 0.3:
        return "Money Mule Chain"
        
    # Pattern 9: Impersonation Fraud (Location Mismatch + Blacklist)
    if f[2] > 0.7 and f[0] > 0.3:
        return SCAM_PATTERNS["IMPERSONATION"]
        
    # Pattern 10: Job/Romance Scam (Behavioral Hesitation + High Amount)
    if f[5] > 0.8 and f[1] > 0.7:
        return SCAM_PATTERNS["JOB_OFFER"]

    return "Social Engineering Pattern"

def predict_via_huggingface(features_list):
    try:
        init_res = requests.post(HF_API_ENDPOINT, json={"data": features_list}, timeout=10)
        event_id = init_res.json().get("event_id")
        result_url = f"{HF_API_ENDPOINT}/{event_id}"
        for _ in range(5):
            time.sleep(0.5)
            res = requests.get(result_url, timeout=10)
            if res.status_code != 200: continue
            lines = res.text.split("\n")
            for line in lines:
                if line.startswith("data:"):
                    data_str = line[5:].strip()
                    prediction_data = json.loads(data_str)
                    if isinstance(prediction_data, list) and len(prediction_data) > 0:
                        return float(prediction_data[0])
        return 0.5
    except Exception as e:
        print(f"HF Error: {e}")
        return 0.5

@app.route("/", methods=["GET"])
def heartbeat():
    return jsonify({"status": "ok", "service": "TruPay Sentinel Gateway"}), 200

@app.route("/predict", methods=["POST"])
def predict():
    data_raw = request.get_json()
    if not data_raw or "features" not in data_raw:
        return jsonify({"error": "No features provided"}), 400

    features_list = [float(x) for x in data_raw["features"]]
    upi_id = data_raw.get("upiId", "mobile_transaction@upi")
    amount = float(data_raw.get("amount", 0))
    transaction_id = data_raw.get("id", f"txn_{int(time.time())}")

    if amount <= 0:
        return jsonify({"status": "ignored", "reason": "zero_amount"}), 200

    print(f"DEBUG: Analyzing {upi_id} patterns...")

    try:
        fraud_prob = predict_via_huggingface(features_list)
        prediction = 1 if fraud_prob >= 0.35 else 0
        
        # --- Real-time Learning Integration ---
        is_learned_fraud = upi_id in LEARNED_FRAUD_VPAs
        
        # Identify the specific scam archetype
        pattern_label = identify_scam_pattern(features_list) if prediction == 1 else "Normal Transaction"
        
        if features_list[0] == 1.0 or is_learned_fraud:
            prediction = 1
            pattern_label = "Blocked by Community Report" if is_learned_fraud else "Blacklisted Recipient (Manual Rule)"
            fraud_prob = 1.0 # Force max risk
            
        print(f"DEBUG: Result: {prediction} | Pattern: {pattern_label}")
        
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500

    timestamp = datetime.now(timezone.utc).isoformat()
    risk_score = int(fraud_prob * 100) if prediction == 1 else int(fraud_prob * 100)
    
    response_payload = {
        "prediction": prediction,
        "status": "Fraud Detected" if prediction == 1 else "Safe",
        "type": pattern_label,
        "riskScore": max(risk_score, 75) if prediction == 1 else risk_score
    }

    with latest_lock:
        latest_result.clear()
        latest_result.update({
            "available": True,
            "timestamp": timestamp,
            "upiId": upi_id,
            "amount": amount,
            "id": transaction_id,
            "features": features_list,
            "prediction": prediction,
            "riskScore": response_payload["riskScore"],
            "scamType": pattern_label
        })

    return jsonify(response_payload)

# --- NEW: Continuous Learning Logic (Problem Statement 4 Requirement) ---
LEARNED_FRAUD_VPAs = set()
TOTAL_REPORTS = 0

@app.route("/feedback", methods=["POST"])
def feedback():
    global TOTAL_REPORTS
    data = request.get_json()
    upi_id = data.get("upiId")
    scam_type = data.get("scamType", "User Reported")
    
    if upi_id:
        LEARNED_FRAUD_VPAs.add(upi_id)
        TOTAL_REPORTS += 1
        print(f"SENTINEL LEARNED: Added {upi_id} to neural blacklist via user report.")
        return jsonify({
            "status": "Success", 
            "message": f"Sentinel has learned from your report. {upi_id} is now globally blocked.",
            "total_knowledge_points": TOTAL_REPORTS
        }), 200
    return jsonify({"error": "Invalid feedback data"}), 400

@app.route("/latest", methods=["GET"])
def latest():
    with latest_lock:
        if not latest_result.get("available"):
            return jsonify({
                "available": False, 
                "message": "Waiting for live transaction...",
                "learning_stats": {"total_reports": TOTAL_REPORTS}
            }), 200
        
        res = latest_result.copy()
        res["learning_stats"] = {"total_reports": TOTAL_REPORTS}
        return jsonify({"latest": res})

def get_local_ips():
    ips = set()
    try:
        hostname = socket.gethostname()
        for info in socket.getaddrinfo(hostname, None, socket.AF_INET):
            ips.add(info[4][0])
    except: pass
    return sorted(ips)

if __name__ == "__main__":
    print("TruPay Sentinel Gateway Live - Modelling 10 Fraud Patterns")
    print(f"API endpoints: {get_local_ips()}")
    app.run(host="0.0.0.0", port=5000, threaded=True)
