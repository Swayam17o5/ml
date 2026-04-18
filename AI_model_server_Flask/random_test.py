import joblib
import numpy as np
import random

# Load the model
model = joblib.load("best_rf_model.pkl")

print("--- AI Model: Random Transaction Stress Test ---")
print(f"{'Test #':<10} | {'Blacklisted':<12} | {'Prob (Fraud)':<12} | {'Prediction'}")
print("-" * 60)

fraud_count = 0
total_tests = 50

for i in range(total_tests):
    # Generate random features
    # Let's make 20% of them blacklisted to see the difference
    is_blacklisted = 1.0 if random.random() < 0.2 else 0.0
    
    # Random values between 0 and 1 for everything else
    features = np.array([[is_blacklisted] + [random.random() for _ in range(21)]])
    
    # Get probability
    prob = model.predict_proba(features)[0][1]
    
    # Prediction (using default 0.5 threshold)
    pred = "FRAUD" if prob >= 0.5 else "SAFE"
    if pred == "FRAUD": fraud_count += 1
    
    if i < 15: # Only show first 15 for brevity
        print(f"{i+1:<10} | {str(is_blacklisted):<12} | {prob:.4f}      | {pred}")

print("-" * 60)
print(f"Total Tests: {total_tests}")
print(f"Fraud Detected: {fraud_count}")
print(f"Fraud Rate: {(fraud_count/total_tests)*100:.1f}%")
print("-" * 60)
