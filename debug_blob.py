import os
import requests
from backend.blob_storage import BlobStorage

# Try to load .env manually to see if it works when loaded
try:
    from dotenv import load_dotenv
    load_dotenv()
    print("Loaded .env using python-dotenv")
except ImportError:
    print("python-dotenv not installed")

token = os.environ.get("BLOB_READ_WRITE_TOKEN")
print(f"Token found: {'Yes' if token else 'No'}")
if token:
    print(f"Token first 5 chars: {token[:5]}...")

storage = BlobStorage()
print("Attempting to list blobs...")
blobs = storage.list()
print(f"Blobs found: {len(blobs)}")
for b in blobs:
    print(f" - {b.get('pathname')} ({b.get('url')})")
