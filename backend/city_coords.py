# Auto-generated city coordinates dictionary (population > 5,000)
# Source: worldcitiespop.csv
# Generated: 2025-12-22T07:22:16.254566
# Entries: 32505
# Key collisions resolved: 2470

CITY_COORDINATES = {   
"amsterdam": [52.3676, 4.9041],
"bangalore": [12.9716, 77.5946],
"singapore": [1.3521, 103.8198],
"delhi": [28.6139, 77.2090],
"granada": [37.1773, -3.5986],
"tangier": [35.7595, -5.8339],
"stockholm": [59.3293, 18.0686],
"tokyo": [35.6762, 139.6503],
"dubai": [25.276987, 55.296249],
"greater noida": [28.4744, 77.5030],
"greater_noida": [28.4744, 77.5030],
"london": [51.5072, -0.1276],
"rotterdam": [51.9225, 4.4792],
"houston": [29.7604, -95.3698],
"new york city": [40.7128, -74.0060],
"new_york_city": [40.7128, -74.0060],
"riyadh": [24.7136, 46.6753],
"rome": [41.9028, 12.4964],
"osaka": [34.6937, 135.5023],
"kochi": [9.9312, 76.2673],
"taipei": [25.0330, 121.5654],
"lake buena vista": [28.3772, -81.5494],
"lake_buena_vista": [28.3772, -81.5494],
"san francisco": [37.7749, -122.4194],
"san_francisco": [37.7749, -122.4194],
"national harbor": [38.7820, -77.0176],
"national_harbor": [38.7820, -77.0176],
"romania": [45.9432, 24.9668],
"malaysia": [4.2105, 101.9758],
"incheon": [37.4563, 126.7052],
"new orleans": [29.9511, -90.0715],
"new_orleans": [29.9511, -90.0715],
"busan": [35.1796, 129.0756],
"honolulu": [21.3069, -157.8583],
"vancouver": [49.2827, -123.1207],
"changsha": [28.2282, 112.9388],
"paris": [48.8566, 2.3522],
"chennai": [13.0827, 80.2707],
"mumbai": [19.0760, 72.8777],
"timisoara": [45.7489, 21.2087],
"utsunomiya": [36.5551, 139.8828],
"sydney": [-33.8688, 151.2093],
"canada": [56.1304, -106.3468],
"iit hyderabad": [17.5936, 78.1232],
"iit_hyderabad": [17.5936, 78.1232],
"doha": [25.276987, 51.520008],
"bali": [-8.3405, 115.0920],
"glasgow": [55.8642, -4.2518],
"graz": [47.0707, 15.4395],
"melbourne": [-37.8136, 144.9631],
"vösendorf": [48.1197, 16.3333],
"barcelona": [41.3851, 2.1734],
"vienna": [48.2100, 16.3738],
"munich": [48.1351, 11.5820],
"ahilyanagar": [19.0948, 75.3333],
"dallas": [32.7767, -96.7970],
"nanjing": [32.0603, 118.7969],
"hefei": [31.8206, 117.2272],
"abu dhabi": [24.4539, 54.3773],
"abu_dhabi": [24.4539, 54.3773],
"anaheim": [33.8366, -117.9143],
"texas": [31.9686, -99.9018],
"joensuu": [62.6010, 29.7636],
"frankfurt": [50.1109, 8.6821],
"birmingham": [52.4862, -1.8904],
"stavanger": [58.9690, 5.7331],
"hanoi": [21.0285, 105.8542],
"italy": [41.8719, 12.5674]
}
def get_coordinates(location_string: str):
    """
    Get coordinates for a location string.
    Tries to match against known cities with improved precision.
    """
    if not location_string:
        return None
    
    # Normalize input
    loc_lower = location_string.lower().strip()
    loc_lower = loc_lower.rstrip('.')
    
    # Handle separators: often city is after a pipe or comma
    # e.g. "Chancery Pavilion Hotel | Bangalore, India"
    # We should try to extract the city part.
    parts = []
    if '|' in loc_lower:
        parts.extend([p.strip() for p in loc_lower.split('|')])
    elif ',' in loc_lower:
        parts.extend([p.strip() for p in loc_lower.split(',')])
    else:
        parts.append(loc_lower)

    # 1. Exact matches on any part
    for part in reversed(parts):
        # Clean comma from part if present for dictionary matching
        p_clean = part.replace(',', '').strip()
        if p_clean in CITY_COORDINATES:
            lat, lng = CITY_COORDINATES[p_clean]
            return {"lat": lat, "lng": lng}

    # 2. Fuzzy containment check with word boundaries
    for part in reversed(parts):
        if len(part) < 3: continue
        p_clean = part.replace(',', '').strip()
        for key, coords in CITY_COORDINATES.items():
            # If key is inside part (e.g. key is "bangalore", part is "bangalore india")
            import re
            if re.search(rf'\b{re.escape(key)}\b', p_clean):
                return {"lat": coords[0], "lng": coords[1]}
    
    return None