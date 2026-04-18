import joblib

# Load the model
model = joblib.load("best_rf_model.pkl")

# Feature names (matching the 22 features)
feature_names = [
    "recipientBlacklisted", "amountAnomaly", "locationMismatch", "vpnDetected", 
    "deviceTrust", "behavioralAnomaly", "newRecipient", "hourOfDay", 
    "velocityScore", "ipReputation", "merchantCategory", "recipientAge", 
    "avgTxnPerDay", "failedAttempts", "sessionDuration", "appTampering", 
    "simSwap", "networkType", "geoVelocity", "batteryAnomaly", 
    "keystrokeCadence", "screenRecording"
]

# Get feature importance
importances = model.feature_importances_
features_with_importance = list(zip(feature_names, importances))
features_with_importance.sort(key=lambda x: x[1], reverse=True)

print("--- AI Model Feature Importance ---")
for name, imp in features_with_importance:
    print(f"{name:25}: {imp:.4f}")
