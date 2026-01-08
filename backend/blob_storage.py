import os
import requests
import json
from typing import Optional, Dict, Any, List

class BlobStorage:
    """
    Simple wrapper for Vercel Blob API using HTTP requests.
    Requires BLOB_READ_WRITE_TOKEN in environment variables.
    """
    def __init__(self):
        self.token = os.environ.get("BLOB_READ_WRITE_TOKEN")
        if not self.token:
            print("WARNING: BLOB_READ_WRITE_TOKEN not found in environment variables.")
        
        self.api_url = "https://blob.vercel-storage.com"
        self.headers = {
            "Authorization": f"Bearer {self.token}"
        }

    def put(self, filename: str, data: str, content_type: str = "application/json") -> Optional[str]:
        """
        Upload data to Vercel Blob. 
        Returns the URL of the uploaded blob or None on failure.
        """
        if not self.token:
            return None
            
        try:
            # Vercel Blob PUT expects the filename in the URL path for simple uploads usually, 
            # or we can use the /mpu/create for larger files, but simple PUT to URL is easier if supported.
            # Official docs typical flow for server-side upload:
            # 1. POST to /api/upload (or similar) - wait, Vercel Blob API is slightly different.
            # Let's use the standard "put" equivalent logic.
            # Actually, standard Vercel Blob SDK does: 
            # PUT https://blob.vercel-storage.com/<filename>
            # Headers: x-api-key: ... (or Authorization: Bearer ...)
            
            url = f"{self.api_url}/{filename}"
            # SSL Verification disabled for local testing environment (self-signed cert issues)
            
            resp = requests.put(url, data=data, headers=self.headers, verify=False)
            resp.raise_for_status()
            
            return resp.json().get("url")
        except Exception as e:
            print(f"Error uploading to Blob: {e}")
            # Try alternative endpoint if the above is guessed wrong. 
            # Looking at docs, usually it is: 
            # POST /search (list)
            # PUT /<path> (upload)
            return None

    def list(self, prefix: str = "") -> List[Dict]:
        """List blobs, optionally filtering by prefix."""
        if not self.token:
            return []
            
        try:
            url = f"{self.api_url}" 
            # The list endpoint typically is GET /?prefix=... or similar on the base URL?
            # Actually, without SDK, the API documentation is key.
            # Let's try the common endpoint: GET https://blob.vercel-storage.com?prefix=...
            
            params = {}
            if prefix:
                params["prefix"] = prefix
                
            resp = requests.get(url, headers=self.headers, params=params, verify=False)
            resp.raise_for_status()
            
            # Response: { "blobs": [ ... ], "hasMore": ... }
            return resp.json().get("blobs", [])
        except Exception as e:
            print(f"Error listing blobs: {e}")
            return resp.json().get("blobs", [])
        except Exception as e:
            print(f"Error listing blobs: {e}")
            return []

    def head(self, url: str) -> Optional[Dict]:
        """Get metadata for a blob."""
        # Not strictly needed if we just list, but good for checking existence by exact URL
        pass 

    def delete(self, url: str) -> bool:
        """Delete a blob by URL."""
        if not self.token: return False
        try:
            # POST /delete with json body: { urls: [url] }
            delete_url = f"{self.api_url}/delete"
            resp = requests.post(delete_url, headers=self.headers, json={"urls": [url]}, verify=False)
            resp.raise_for_status()
            return True
        except Exception as e:
            print(f"Error deleting blob: {e}")
            return False

    def get_json(self, url: str) -> Optional[Any]:
        """Download and parse JSON from a Blob URL."""
        try:
            # SSL Verification disabled for local testing
            resp = requests.get(url, headers=self.headers, verify=False)
            resp.raise_for_status()
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            print(f"Error reading blob {url}: {e}")
            return None
