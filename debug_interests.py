from dotenv import load_dotenv
load_dotenv()
from backend.data_manager import data_manager
import json

blobs = data_manager.blob_storage.list(prefix="")
with open("debug_output.txt", "w") as f:
    f.write(f"Total Blobs Found: {len(blobs)}\n")
    for b in blobs:
        f.write(f"Path: {b['pathname']}, Url: {b['url']}\n")

    print("--- Testing get_interests() (Aggregation) ---")
    interests = data_manager.get_interests()
    f.write(f"Aggregated Rows: {len(interests)}\n")
    for item in interests:
        f.write(json.dumps(item, indent=2) + "\n")
print("Debug finished. Check debug_output.txt")
