import joblib
import numpy as np
import os

# Path to the model
MODEL_PATH = "best_rf_model.pkl"

if not os.path.exists(MODEL_PATH):
    print(f"Error: {MODEL_PATH} not found.")
    exit(1)

# Load the model
model = joblib.load(MODEL_PATH)

# Suspicious features (Behavioral pattern)
# No blacklist flag (0.0 at index 0)
features = np.array([[
    0.0,  # recipientBlacklisted
    0.95, # amountAnomaly
    1.0,  # locationMismatch
    1.0,  # vpnDetected
    0.1,  # deviceTrust
    0.85, # behavioralAnomaly
    1.0,  # newRecipient
    0.05, # hourOfDay
    0.9,  # velocityScore
    0.15, # ipReputation
    1.0,  # merchantCategory
    5.0,  # recipientAge
    25.0, # avgTxnPerDay
    3.0,  # failedAttempts
    45.0, # sessionDuration
    1.0,  # appTampering
    0.0,  # simSwap
    1.0,  # networkType
    0.8,  # geoVelocity
    0.2,  # batteryAnomaly
    1.0,  # keystrokeCadence
    1.0   # screenRecording
]])

# Check probabilities
prob = model.predict_proba(features)[0]
fraud_prob = prob[1]

print(f"--- AI Model Internal Analysis ---")
print(f"Probability of Fraud: {fraud_prob:.4f}")

if fraud_prob >= 0.5:
    print("Result: FRAUD (Threshold 0.5)")
elif fraud_prob >= 0.35:
    print("Result: SUSPICIOUS (Threshold 0.35)")
else:
    print("Result: SAFE")

# Show what it would have been with the default prediction
print(f"Default model.predict() result: {model.predict(features)[0]}")
