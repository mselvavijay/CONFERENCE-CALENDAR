import pandas as pd
import json
import os
from typing import List, Dict, Optional
from datetime import datetime
from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut, GeocoderServiceError
import time

# Use absolute path relative to this file
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Vercel environments have a read-only filesystem except for /tmp
IS_VERCEL = "VERCEL" in os.environ

if IS_VERCEL:
    STORAGE_DIR = "/tmp/storage"
    os.makedirs(STORAGE_DIR, exist_ok=True)
else:
    STORAGE_DIR = os.path.join(BASE_DIR, "storage")

from backend.blob_storage import BlobStorage

DATA_FILE = os.path.join(STORAGE_DIR, "events.json")
# INTERESTS_FILE removed in favor of Blob
SEED_DATA_FILE = os.path.join(BASE_DIR, "storage", "events.json")
BLOB_INTERESTS_KEY = "user_interests.json"

class DataManager:
    def __init__(self):
        self.events: List[Dict] = []
        self.geocoder = Nominatim(user_agent="conference_portal_app")
        self.geocache = {}  # Cache to avoid repeated API calls
        
        self.blob_storage = BlobStorage()
        
        # On Vercel, seed the /tmp/storage if it's empty
        if IS_VERCEL and not os.path.exists(DATA_FILE) and os.path.exists(SEED_DATA_FILE):
             import shutil
             shutil.copy2(SEED_DATA_FILE, DATA_FILE)
             
        self.load_data()

    def _fetch_all_raw_interests(self) -> List[Dict]:
        """Helper to fetch all individual interest blobs."""
        try:
            # Relaxed prefix to 'interests' generally
            blobs = self.blob_storage.list(prefix="interests")
            all_interests = []
            
            for b in blobs:
                # Double check path if needed
                if "interests" not in b.get("pathname", ""):
                    continue
                    
                url = b.get("url")
                data = self.blob_storage.get_json(url)
                if data:
                    if isinstance(data, list):
                        all_interests.extend(data)
                    elif isinstance(data, dict):
                        all_interests.append(data)
            return all_interests
        except Exception as e:
            print(f"Error fetching raw interests: {e}")
            return []

    def save_interest(self, user_data: Dict) -> Dict:
        """
        Save user interest as a separate blob.
        """
        try:
            # 1. Prepare Data
            event_id = user_data.get("eventId")
            event = next((e for e in self.events if e["id"] == event_id), None)
            
            if not event:
                return {"status": "error", "message": "Event not found"}

            event_price = event.get("price", "TBD")
            email = user_data.get("email", "").strip().lower()

            # 1.5 Domain Validation
            if not email.endswith("@bakerhughes.com"):
                return {"status": "error", "message": "Access restricted. Please use a valid @bakerhughes.com email address."}

            record = {
                "firstName": user_data.get("firstName"),
                "lastName": user_data.get("lastName"),
                "username": user_data.get("username"),
                "email": email,
                "role": user_data.get("role"),
                "city": user_data.get("city"),
                "country": user_data.get("country"),
                "topic": event.get("topic"),
                "eventName": event.get("eventName"),
                "eventPrice": event_price,
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }

            # 2. Duplicate Check (Requires fetching all)
            existing_data = self._fetch_all_raw_interests()
            
            is_duplicate = False
            for entry in existing_data:
                same_event = entry.get("eventName") == record["eventName"]
                same_user = (entry.get("email") == record["email"]) or (entry.get("username") == record["username"])
                if same_event and same_user:
                    is_duplicate = True
                    break

            if is_duplicate:
                return {"status": "error", "message": "You have already registered interest for this event."}

            # 3. Save as NEW Blob (Single Object)
            # Vercel Blob will add a random suffix ensuring uniqueness if we don't overwrite
            try:
                # We save just the dict, or a list of one dict? User said "blobs for every interests".
                # Standard is usually storing the object itself.
                self.blob_storage.put("interests/interest.json", json.dumps(record, indent=2))
            except Exception as e:
                print(f"Failed to upload to blob: {e}")
                raise e

            return {"status": "success", "message": "Interest registered successfully!"}

        except Exception as e:
            print(f"Error saving interest: {e}")
            return {"status": "error", "message": str(e)}

    def remove_interest(self, event_id: str, email: str) -> Dict:
        """
        Remove user interest by deleting the corresponding blob.
        """
        try:
            # 1. Get Event Name
            event = next((e for e in self.events if e["id"] == event_id), None)
            if not event:
                return {"status": "error", "message": "Event not found"}
            
            target_event_name = event.get("eventName")
            target_email = email.strip().lower()

            # 2. Find and Delete the Blob
            blobs = self.blob_storage.list(prefix="interests")
            deleted_count = 0
            
            for b in blobs:
                url = b.get("url")
                # We need to fetch the JSON to verify the email and eventName
                # because Vercel Blob listing doesn't show custom metadata easily in list
                data = self.blob_storage.get_json(url)
                
                if data and isinstance(data, dict):
                    blob_email = str(data.get("email", "")).strip().lower()
                    blob_event = data.get("eventName")
                    
                    if blob_email == target_email and blob_event == target_event_name:
                        # Match found! Delete it.
                        success = self.blob_storage.delete(url)
                        if success:
                            deleted_count += 1

            if deleted_count > 0:
                return {"status": "success", "message": f"Interest removed successfully."}
            else:
                return {"status": "error", "message": "No matching interest found to remove."}

        except Exception as e:
            print(f"Error removing interest: {e}")
            return {"status": "error", "message": str(e)}

    def remove_all_interests_for_event(self, event_name: str) -> Dict:
        """
        Remove ALL interests for a specific event (Admin function).
        """
        try:
            blobs = self.blob_storage.list(prefix="interests")
            deleted_count = 0
            
            for b in blobs:
                url = b.get("url")
                data = self.blob_storage.get_json(url)
                
                if data and isinstance(data, dict):
                    if data.get("eventName") == event_name:
                        success = self.blob_storage.delete(url)
                        if success:
                            deleted_count += 1

            return {"status": "success", "message": f"Successfully removed {deleted_count} interests for '{event_name}'."}

        except Exception as e:
            print(f"Error clearing event interests: {e}")
            return {"status": "error", "message": str(e)}

    def get_interests(self) -> List[Dict]:
        """
        Fetch all interests and AGGREGATE them for Admin Dashboard.
        Returns: [{ 'Event Name', 'Fees', 'No. of interests', 'Total' }]
        """
        try:
            raw_data = self._fetch_all_raw_interests()
            
            # Aggregation Logic
            # Group by Event Name + Price
            # Output: Event Name, Fees, No. of interests, Total
            
            grouped = {}
            
            for item in raw_data:
                event_name = item.get("eventName", "Unknown")
                price_str = str(item.get("eventPrice", "0")).replace("$", "").replace(",", "")
                
                # Parse price
                try:
                    price = float(price_str) if price_str.lower() != "tbd" else 0
                except:
                    price = 0
                    
                key = (event_name, item.get("eventPrice", "TBD"))
                
                if key not in grouped:
                    grouped[key] = {
                        "count": 0,
                        "total_value": 0
                    }
                
                grouped[key]["count"] += 1
                grouped[key]["total_value"] += price

            # Format result
            results = []
            for (ev_name, ev_price), stats in grouped.items():
                results.append({
                    "Event Name": ev_name,
                    "Fees": ev_price,
                    "No. of interests": stats["count"],
                    "Total": stats["total_value"] # Or should this be formatted with currency?
                })
                
            return results
        except Exception as e:
            print(f"Error fetching interests from blob: {e}")
            return []
    
    # get_interests_file removed as we generate on fly now

    def load_data(self):
        if os.path.exists(DATA_FILE):
            try:
                with open(DATA_FILE, 'r', encoding='utf-8') as f:
                    self.events = json.load(f)
                
                # Cleanup: Ensure unique IDs and remove duplicates that might have been caused by old logic
                unique_events = {}
                for event in self.events:
                    # Regenerate ID using stable logic
                    event_id = self.generate_id(event.get("eventName", ""), event.get("startDate", ""), event.get("location_raw", ""))
                    event["id"] = event_id
                    
                    # Deduplicate: Keep the one with coordinates if available
                    if event_id not in unique_events:
                        unique_events[event_id] = event
                    else:
                        existing = unique_events[event_id]
                        if (existing.get("lat") is None) and (event.get("lat") is not None):
                            unique_events[event_id] = event
                
                self.events = list(unique_events.values())
                # Save cleaned data
                self.save_data()
            except Exception as e:
                print(f"Error loading data: {e}")
                self.events = []
        else:
            self.events = []

    def generate_id(self, event_name: str, start_date: str, location_raw: str) -> str:
        """Generate a stable, unique ID for an event."""
        # Use location_raw as it's more stable than parsed city
        clean_name = str(event_name).strip()
        clean_date = str(start_date).strip()
        clean_loc = str(location_raw).strip()
        
        id_str = f"{clean_name}_{clean_date}_{clean_loc}".replace(" ", "_")
        # Remove characters that might be problematic in URLs or IDs
        invalid_chars = '<>:"/\\|?*\'`'
        for char in invalid_chars:
            id_str = id_str.replace(char, "")
        return id_str

    def save_data(self):
        os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(self.events, f, ensure_ascii=False, indent=2)

    def geocode_location(self, city: str, country: str = "", raw_location: str = "") -> Optional[Dict]:
        """Get lat/long for a location, with caching and rate limiting."""
        from backend.city_coords import get_coordinates
        
        # Create cache key
        cache_key = f"{city},{country},{raw_location}".lower().strip()
        
        if cache_key in self.geocache:
            return self.geocache[cache_key]
        
        # Strategy 0: Try static database first (fast and reliable)
        coords = get_coordinates(raw_location or city)
        if coords:
            self.geocache[cache_key] = coords
            return coords
        
        try:
            # Strategy 1: Try the raw location string with online geocoding
            if raw_location:
                time.sleep(1)
                location = self.geocoder.geocode(raw_location, timeout=10)
                if location:
                    coords = {
                        "lat": location.latitude,
                        "lng": location.longitude
                    }
                    self.geocache[cache_key] = coords
                    return coords
            
            # Strategy 2: Try city, country
            if city:
                query = f"{city}, {country}" if country else city
                time.sleep(1)
                location = self.geocoder.geocode(query, timeout=10)
                
                if location:
                    coords = {
                        "lat": location.latitude,
                        "lng": location.longitude
                    }
                    self.geocache[cache_key] = coords
                    return coords
            
            # Failed
            self.geocache[cache_key] = None
            return None
                
        except (GeocoderTimedOut, GeocoderServiceError):
            # Return None, cache will prevent retrying
            self.geocache[cache_key] = None
            return None

    def re_geocode_all(self, force: bool = True) -> Dict:
        """Re-geocode all events (optionally only those missing coordinates)."""
        geocoded_count = 0
        failed_count = 0
        failures = []
        
        for event in self.events:
            # If force is True, we re-geocode everything. 
            # Otherwise we only geocode missing ones.
            if force or event.get("lat") is None or event.get("lng") is None:
                city = event.get("city", "")
                country = event.get("country", "")
                raw_loc = event.get("location_raw", "")
                
                if city or raw_loc:
                    coords = self.geocode_location(city, country, raw_loc)
                    if coords:
                        event["lat"] = coords["lat"]
                        event["lng"] = coords["lng"]
                        geocoded_count += 1
                    else:
                        failed_count += 1
                        failures.append({
                            "eventName": event.get("eventName", "Unknown"),
                            "location": raw_loc or city,
                            "reason": "Location not found"
                        })
        
        self.save_data()
        return {
            "geocoded": geocoded_count, 
            "failed": failed_count, 
            "total": len(self.events),
            "failures": failures
        }

    def process_excel(self, file_content: bytes) -> Dict[str, str]:
        try:
            # Read Excel from bytes
            df = pd.read_excel(file_content)
            
            # Normalize Headers for easier matching
            
            # Normalize Headers for easier matching
            # logic: strip, lower. But we need to handle the unnamed one for links.
            # Let's create a map of "Expected Name" -> "Actual Column Name in DF"
            
            col_map = {}
            unnamed_link_col = None

            for col in df.columns:
                c_str = str(col).strip()
                c_lower = c_str.lower()
                
                if "topic" in c_lower: col_map["topic"] = col
                elif "event name" in c_lower or "eventname" in c_lower: col_map["eventName"] = col
                elif "start date" in c_lower or "startdate" in c_lower: col_map["startDate"] = col
                elif "end date" in c_lower or "enddate" in c_lower: col_map["endDate"] = col
                elif "location" in c_lower: col_map["location"] = col
                elif "agencies" in c_lower: col_map["agencies"] = col
                elif "quarter" in c_lower: col_map["quarter"] = col
                elif "fees" in c_lower or "price" in c_lower or "cost" in c_lower or "budget" in c_lower: col_map["price"] = col
                elif c_str.startswith("Unnamed"): 
                    # Assuming the unnamed column after location is the link
                    # For safety, we might check if the content looks like a URL later, 
                    # but for now let's just grab the first unnamed one or the one at index 6 if strictly ordered
                    if unnamed_link_col is None: unnamed_link_col = col

            # Fallback for Link if specific order is implied: 
            # User said: Topic, Event name, Start date, End date, Quarter, Location, [LINK], Agencies
            # Indexes: 0, 1, 2, 3, 4, 5, 6, 7
            if len(df.columns) > 6 and "Unnamed" in str(df.columns[6]):
                unnamed_link_col = df.columns[6]

            def find_url_in_row(row):
                """Search all columns in a row for something that looks like a URL."""
                for val in row:
                    v_str = str(val).strip()
                    if v_str.startswith("http://") or v_str.startswith("https://") or "www." in v_str:
                        return v_str
                return ""

            # Validation
            # We strictly need Event Name and Start Date at minimum to display something useful?
            # User error said "Missing required columns: city, country" previously.
            # New required: Topic, Event name
            
            required_keys = ["topic", "eventName", "location"] 
            missing = [k for k in required_keys if k not in col_map]
            
            if missing:
                 # Be more lenient if we can't find keys but have enough columns? 
                 # For now, return error to help user debug their sheet
                return {"status": "error", "message": f"Could not find columns for: {', '.join(missing)}. Detected: {list(df.columns)}"}

            new_events = []
            for _, row in df.iterrows():
                def get_val(key, default=""):
                    if key in col_map and pd.notna(row[col_map[key]]):
                        return str(row[col_map[key]]).strip()
                    return default

                # Date Parsing (DD-MM-YYYY)
                def parse_date(date_str):
                    if not date_str: return ""
                    try:
                        # Try standard formats
                        # check if it's already datetime object from pandas
                        if isinstance(row[col_map["startDate"]], datetime):
                             return row[col_map["startDate"]].strftime("%Y-%m-%d")
                        
                        # String parsing
                        # User specified mostly DD-MM-YYYY e.g. 08-10-2025
                        # Pandas to_datetime is smart, let's try it with dayfirst=True
                        dt = pd.to_datetime(date_str, dayfirst=True, errors='coerce')
                        if pd.notna(dt):
                            return dt.strftime("%Y-%m-%d")
                        return str(date_str) 
                    except:
                        return str(date_str)

                # Location Parsing (City/Country)
                # Formats seen: "London, UK" or "Amsterdam Netherlands" or "Singapore"
                raw_loc = get_val("location")
                city = raw_loc
                country = ""
                
                if "," in raw_loc:
                    # Format: "City, Country"
                    parts = raw_loc.split(",")
                    city = parts[0].strip()
                    country = parts[-1].strip()
                elif "|" in raw_loc:
                    # Format: "Property | City, Country"
                    parts = raw_loc.split("|")
                    city = parts[-1].strip() # Take the part after pipe as more specific city/country
                    if "," in city:
                        subparts = city.split(",")
                        city = subparts[0].strip()
                        country = subparts[-1].strip()
                else:
                    # Format: "City Country" or just "City"
                    # Try to split by space and take last word as country if multiple words
                    parts = raw_loc.strip().split()
                    if len(parts) >= 2:
                        # Heuristic: Last word might be country
                        # Common countries: India, USA, UK, Japan, China, etc.
                        potential_country = parts[-1]
                        # If last part looks like a country (or has known patterns), split it
                        if potential_country in ['India', 'USA', 'UK', 'Japan', 'China', 'Korea', 'France', 
                                                  'Germany', 'Spain', 'Italy', 'Canada', 'Australia', 
                                                  'Netherlands', 'Singapore', 'Malaysia', 'Taiwan',
                                                  'Morocco', 'Sweden', 'Romania', 'UAE', 'UAE.']:
                            city = ' '.join(parts[:-1])
                            country = potential_country.rstrip('.')  # Remove trailing period
                        else:
                            city = raw_loc
                            country = ""
                    else:
                        city = raw_loc
                        country = ""
                
                # Link
                link = ""
                if unnamed_link_col and pd.notna(row[unnamed_link_col]):
                    link = str(row[unnamed_link_col]).strip()
                
                # Fallback: if link is still empty or doesn't look like a URL, search all columns
                if not link or not (link.startswith("http") or "www." in link):
                    link = find_url_in_row(row)

                start_date = parse_date(row.get(col_map.get("startDate")))
                end_date = parse_date(row.get(col_map.get("endDate")))

                # Geocode the location - pass raw location for best results
                coords = self.geocode_location(city, country, raw_loc)

                event_id = self.generate_id(get_val('eventName'), start_date, raw_loc)

                event = {
                    "id": event_id,
                    "eventName": get_val("eventName"),
                    "topic": get_val("topic"),
                    "startDate": start_date,
                    "endDate": end_date,
                    "city": city,
                    "country": country,
                    "location_raw": raw_loc, # Store original
                    "quarter": get_val("quarter"),
                    "organizer": get_val("agencies"), # Mapping Agencies -> Organizer
                    "registrationUrl": link if link else "#",
                    "description": "", # No description column mentioned?
                    "tags": "",
                    "price": get_val("price", "TBD"), # Store as price
                    "lat": coords["lat"] if coords else None,
                    "lng": coords["lng"] if coords else None
                }
                new_events.append(event)
            
            # Replace local events with new events
            self.events = new_events
            
            self.save_data()
            return {
                "status": "success", 
                "message": f"Database Refreshed: Processed {len(new_events)} rows. Total events in system: {len(self.events)}."
            }

        except Exception as e:
            return {"status": "error", "message": f"Processing Error: {str(e)}"}

    def get_events(self, filters: Optional[Dict] = None) -> List[Dict]:
        if not filters:
            return self.events
        
        filtered = self.events
        # Implement filtering logic here if needed server-side
        # For now, returning all and letting client filter or adding simple matches
        return filtered

    def get_filter_options(self) -> Dict[str, List[str]]:
        # Helper to get unique values for typeahead
        keys = ["topic", "city", "country", "tags"]
        options = {k: set() for k in keys}
        
        for ev in self.events:
            for k in keys:
                val = ev.get(k)
                if val:
                    # Handle tags list
                    if k == "tags":
                         # Assume comma separated
                        for tag in val.split(","):
                            options[k].add(tag.strip())
                    else:
                        options[k].add(val)
        
        return {k: sorted(list(v)) for k, v in options.items()}

data_manager = DataManager()
