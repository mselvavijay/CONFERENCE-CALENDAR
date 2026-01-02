import requests
import os

BASE_URL = "http://localhost:8081/api"
ADMIN_URL = f"{BASE_URL}/admin"
FILE_PATH = "sample_events_v2.xlsx"
PASSPHRASE = "admin123"

def test_api():
    print("Testing API with V2 Schema...")
    
    if not os.path.exists(FILE_PATH):
        print(f"Error: {FILE_PATH} not found.")
        return

    files = {'file': open(FILE_PATH, 'rb')}
    try:
        print(f"Uploading {FILE_PATH}...")
        response = requests.post(f"{ADMIN_URL}/upload", files=files, params={"passphrase": PASSPHRASE})
        if response.status_code == 200:
            print("✅ Upload Success:", response.json())
        else:
            print(f"❌ Upload Failed: {response.status_code} - {response.text}")
            return
    except Exception as e:
        print(f"❌ Connection Error: {e}")
        return

    try:
        print("Fetching Events...")
        response = requests.get(f"{BASE_URL}/events")
        if response.status_code == 200:
            events = response.json()
            print(f"✅ Fetch Success. Total Events: {len(events)}")
            for e in events:
                print(f"   - {e['eventName']} | {e['city']} | {e['startDate']} | Link: {e['registrationUrl']}")
        else:
            print(f"❌ Fetch Failed: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"❌ Connection Error: {e}")

if __name__ == "__main__":
    test_api()
