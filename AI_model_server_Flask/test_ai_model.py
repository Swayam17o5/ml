import requests
import json

# The Flask Server URL
URL = "http://127.0.0.1:5000/predict"

# 22 Features for the AI Model
# Index 0 is 'recipientBlacklisted' - we set this to 0.0 to prove the AI is thinking!
features = [
    0.0,  # recipientBlacklisted (0 = Not blacklisted)
    0.95, # amountAnomaly (High)
    1.0,  # locationMismatch (Yes - High Impact)
    1.0,  # vpnDetected (Yes)
    0.1,  # deviceTrust (Very Low - High Impact)
    0.85, # behavioralAnomaly (High)
    1.0,  # newRecipient (Yes)
    0.05, # hourOfDay (Late night)
    0.9,  # velocityScore (High)
    0.15, # ipReputation (Bad)
    1.0,  # merchantCategory (High Risk - High Impact)
    5.0,  # recipientAge (Brand new account)
    25.0, # avgTxnPerDay (Spike in activity)
    3.0,  # failedAttempts (Several failures)
    45.0, # sessionDuration (Short session)
    1.0,  # appTampering (Yes)
    0.0,  # simSwap (No)
    1.0,  # networkType (Public WiFi)
    0.8,  # geoVelocity (High)
    0.2,  # batteryAnomaly (Yes)
    1.0,  # keystrokeCadence (Irregular - High Impact)
    1.0   # screenRecording (Yes)
]

payload = {
    "features": features,
    "upiId": "test_suspicious_user@upi",
    "amount": 75000,
    "id": "test_txn_ai_only"
}

print(f"Sending suspicious transaction (Blacklist: {features[0]}) to AI Model...")

try:
    response = requests.post(URL, json=payload)
    result = response.json()
    
    print("\n--- AI Response ---")
    print(f"Status Code: {response.status_code}")
    print(f"Prediction: {result.get('prediction')} (1 = FRAUD, 0 = SAFE)")
    print(f"Model Logic: {result.get('status')}")
    print(f"Details: {result.get('type')}")
    
    if result.get('prediction') == 1:
        print("\nSUCCESS: The AI model correctly identified fraud based on the PATTERN, even though the user wasn't blacklisted!")
    else:
        print("\nFAILED: The model thought this suspicious pattern was safe.")

except Exception as e:
    print(f"Error connecting to server: {e}")
