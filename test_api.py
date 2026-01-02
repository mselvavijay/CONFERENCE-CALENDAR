import requests
import os

BASE_URL = "http://localhost:8081/api"
ADMIN_URL = f"{BASE_URL}/admin"
FILE_PATH = "sample_events.xlsx"
PASSPHRASE = "admin123"

def test_api():
    print("Testing API...")
    
    # 1. Test Upload
    if not os.path.exists(FILE_PATH):
        print(f"Error: {FILE_PATH} not found. Run generate_sample.py first.")
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

    # 2. Test Get Events
    try:
        print("Fetching Events...")
        response = requests.get(f"{BASE_URL}/events")
        if response.status_code == 200:
            events = response.json()
            print(f"✅ Fetch Success. Total Events: {len(events)}")
            if len(events) > 0:
                print(f"   Sample: {events[0]['eventName']} in {events[0]['city']}")
            else:
                print("   ⚠️ No events returned.")
        else:
            print(f"❌ Fetch Failed: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"❌ Connection Error: {e}")

if __name__ == "__main__":
    test_api()
