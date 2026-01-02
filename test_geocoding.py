from geopy.geocoders import Nominatim
import time

geolocator = Nominatim(user_agent="conference_portal_test")

# Test a few locations
test_locations = [
    "Amsterdam Netherlands",
    "London, UK",
    "Singapore",
    "Tokyo Japan"
]

for loc in test_locations:
    try:
        time.sleep(1)
        result = geolocator.geocode(loc, timeout=10)
        if result:
            print(f"✅ {loc}: ({result.latitude}, {result.longitude})")
        else:
            print(f"❌ {loc}: Not found")
    except Exception as e:
        print(f"❌ {loc}: Error - {e}")
