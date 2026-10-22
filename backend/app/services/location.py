import copy

import json

import logging

import math
import os
from pathlib import Path

import threading

import time

import urllib.error

import urllib.parse

import urllib.request

logger = logging.getLogger(__name__)

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"

GEOAPIFY_PLACES_URL = "https://api.geoapify.com/v2/places"
GEOAPIFY_CATEGORIES = {
    "cafe": ["catering.cafe"],
    "restaurant": ["catering.restaurant", "catering.fast_food"],
    "bakery": ["commercial.food_and_drink", "catering.cafe"],
    "grocery": ["commercial.supermarket", "commercial.convenience"],
    "salon": ["commercial.hairdresser", "commercial.beauty"],
    "pharmacy": ["healthcare.pharmacy"],
    "gym": ["leisure.fitness_centre", "sport.fitness"],
    "clothing": ["commercial.clothing"],
    "general": [
        "commercial",
        "catering",
        "healthcare.pharmacy",
        "leisure.fitness_centre",
    ],
    "office_coworking": ["commercial"],
    "laundry_cleaning": ["commercial", "service"],
    "automotive": ["commercial", "service"],
    "education": ["education"],
}


def _load_geoapify_api_key():
    """Read the key from the environment or a local backend/project .env file."""
    key = os.getenv("GEOAPIFY_API_KEY", "").strip()
    if key:
        return key

    project_root = Path(__file__).resolve().parents[3]
    for env_path in (project_root / ".env", project_root / "backend" / ".env"):
        if not env_path.is_file():
            continue
        try:
            for line in env_path.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                name, value = line.split("=", 1)
                if name.strip() == "GEOAPIFY_API_KEY":
                    return value.strip().strip("\"'")
        except OSError:
            logger.warning("Could not read environment file: %s", env_path)
    return ""


GEOAPIFY_API_KEY = _load_geoapify_api_key()

USER_AGENT = "VentureSpot/1.0 (local business location research)"

# Keep network waits short. Public services can still be slow or unavailable.

GEOCODING_TIMEOUT_SECONDS = 10

PLACES_TIMEOUT_SECONDS = 12

# Cached geocoding results last a day; nearby-business results last 10 minutes.

GEOCODING_CACHE_TTL = 24 * 60 * 60

BUSINESS_CACHE_TTL = 10 * 60

MAX_CACHE_ENTRIES = 256

SUPPORTED_CATEGORIES = {

    "cafe",

    "restaurant",

    "bakery",

    "grocery",

    "salon",

    "pharmacy",

    "gym",

    "clothing",

    "general",
    "office_coworking",
    "laundry_cleaning",
    "automotive",
    "education",

}

class LocationServiceError(Exception):

    """Raised when external location services cannot return usable data."""

# Simple in-memory cache. No Redis or additional package is required.

_cache = {}

_cache_lock = threading.Lock()

def _cache_get(key):

    now = time.monotonic()

    with _cache_lock:

        entry = _cache.get(key)

        if entry is None:

            return None

        expires_at, value = entry

        if now >= expires_at:

            del _cache[key]

            return None

        # Return a copy so callers cannot accidentally modify cached data.

        return copy.deepcopy(value)

def _cache_set(key, value, ttl):

    now = time.monotonic()

    with _cache_lock:

        # Remove expired entries to keep the cache small.

        expired_keys = [

            cache_key

            for cache_key, (expires_at, _) in _cache.items()

            if now >= expires_at

        ]

        for cache_key in expired_keys:

            _cache.pop(cache_key, None)

        # Evict the oldest inserted entry if the cache is full.

        if key not in _cache and len(_cache) >= MAX_CACHE_ENTRIES:

            oldest_key = next(iter(_cache))

            _cache.pop(oldest_key, None)

        _cache[key] = (now + ttl, copy.deepcopy(value))

def _get_json(url, timeout=GEOCODING_TIMEOUT_SECONDS):

    request = urllib.request.Request(

        url,

        headers={

            "User-Agent": USER_AGENT,

            "Accept": "application/json",

        },

    )

    try:

        with urllib.request.urlopen(request, timeout=timeout) as response:

            return json.loads(response.read().decode("utf-8"))

    except urllib.error.HTTPError as exc:

        logger.warning("Location GET returned HTTP %s: %s", exc.code, url)

        raise LocationServiceError(

            f"Address lookup returned HTTP {exc.code}."

        ) from exc

    except (

        urllib.error.URLError,

        TimeoutError,

        json.JSONDecodeError,

        UnicodeDecodeError,

        OSError,

    ) as exc:

        logger.warning("Location GET failed for %s: %s", url, exc)

        raise LocationServiceError(

            "Address lookup failed due to a connection or response error."

        ) from exc

def geocode_location(address: str) -> dict:

    address = address.strip()

    if not address:

        raise ValueError("Please enter a business address.")

    cache_key = ("geocode", address.casefold())

    cached = _cache_get(cache_key)

    if cached is not None:

        logger.info("Geocoding cache hit")

        return cached

    params = urllib.parse.urlencode({

        "q": address,

        "format": "jsonv2",

        "limit": 1,

        "addressdetails": 1,

    })

    results = _get_json(f"{NOMINATIM_URL}?{params}")

    if not results:

        raise ValueError(

            "Address not found. Try adding the city, state, or PIN code."

        )

    result = results[0]

    location = {

        "display_name": result.get("display_name", address),

        "latitude": float(result["lat"]),

        "longitude": float(result["lon"]),

        "source": "OpenStreetMap Nominatim",

    }

    _cache_set(cache_key, location, GEOCODING_CACHE_TTL)

    return location

def _category_filters(category: str) -> list[tuple[str, str]]:

    filters = {

        "cafe": [

            ('["amenity"="cafe"]', "cafe"),

        ],

        "restaurant": [

            ('["amenity"="restaurant"]', "restaurant"),

            ('["amenity"="fast_food"]', "fast_food"),

        ],

        "bakery": [

            ('["shop"="bakery"]', "bakery"),

        ],

        "grocery": [

            ('["shop"="supermarket"]', "supermarket"),

            ('["shop"="convenience"]', "convenience"),

            ('["shop"="grocery"]', "grocery"),

        ],

        "salon": [

            ('["shop"="hairdresser"]', "hairdresser"),

            ('["shop"="beauty"]', "beauty"),

        ],

        "pharmacy": [

            ('["amenity"="pharmacy"]', "pharmacy"),

            ('["shop"="chemist"]', "chemist"),

        ],

        "gym": [

            ('["leisure"="fitness_centre"]', "fitness_centre"),

            ('["amenity"="gym"]', "gym"),

        ],

        "clothing": [

            ('["shop"="clothes"]', "clothes"),

            ('["shop"="fashion"]', "fashion"),

        ],

        "general": [

            ('["shop"]', "shop"),

            ('["amenity"="cafe"]', "cafe"),

            ('["amenity"="restaurant"]', "restaurant"),

            ('["amenity"="fast_food"]', "fast_food"),

            ('["amenity"="pharmacy"]', "pharmacy"),

            ('["leisure"="fitness_centre"]', "fitness_centre"),

        ],

    }

    return filters[category]

def _haversine_distance_m(

    latitude1: float,

    longitude1: float,

    latitude2: float,

    longitude2: float,

) -> float:

    earth_radius_m = 6_371_000

    lat1 = math.radians(latitude1)

    lat2 = math.radians(latitude2)

    delta_lat = math.radians(latitude2 - latitude1)

    delta_lon = math.radians(longitude2 - longitude1)

    value = (

        math.sin(delta_lat / 2) ** 2

        + math.cos(lat1)

        * math.cos(lat2)

        * math.sin(delta_lon / 2) ** 2

    )

    value = min(1.0, max(0.0, value))

    return (

        earth_radius_m

        * 2

        * math.atan2(math.sqrt(value), math.sqrt(1 - value))

    )

def _competition_summary(competitors: list[dict], radius_m: int) -> dict:

    count = len(competitors)

    radius_km = radius_m / 1000

    area_km2 = math.pi * radius_km**2

    density = round(count / area_km2, 2) if area_km2 else 0

    within_500m = sum(

        item["distance_m"] <= 500 for item in competitors

    )

    within_1km = sum(

        item["distance_m"] <= 1000 for item in competitors

    )

    if count <= 3:

        indicator = "low"

    elif count <= 9:

        indicator = "moderate"

    else:

        indicator = "high"

    return {

        "competitor_count": count,

        "estimated_competitors_per_km2": density,

        "within_500m": within_500m,

        "within_1km": within_1km,

        "preliminary_competition_indicator": indicator,

        "indicator_note": (

            "This is a preliminary count-based heuristic, not a validated "

            "market benchmark or a prediction of revenue loss."

        ),

    }

def find_nearby_businesses(
    latitude: float,
    longitude: float,
    radius_m: int = 1000,
    category: str = "cafe",
) -> dict:
    """Find nearby competitors through Geoapify Places API.

    Set GEOAPIFY_API_KEY in the backend environment. The returned schema is
    intentionally kept compatible with VentureSpot's existing frontend.
    """
    category = category.strip().lower()

    if category not in SUPPORTED_CATEGORIES:
        raise ValueError(
            "Unsupported category. Choose from: "
            + ", ".join(sorted(SUPPORTED_CATEGORIES))
        )
    if not -90 <= latitude <= 90:
        raise ValueError("Latitude must be between -90 and 90.")
    if not -180 <= longitude <= 180:
        raise ValueError("Longitude must be between -180 and 180.")
    if not 100 <= radius_m <= 5000:
        raise ValueError("Search radius must be between 100 and 5000 metres.")
    if not GEOAPIFY_API_KEY:
        raise LocationServiceError(
            "Geoapify is not configured. Add GEOAPIFY_API_KEY to the backend environment and restart the server."
        )

    cache_key = (
        "geoapify-businesses",
        round(latitude, 5),
        round(longitude, 5),
        radius_m,
        category,
    )
    cached = _cache_get(cache_key)
    if cached is not None:
        logger.info("Nearby-business cache hit (Geoapify)")
        return cached

    params = urllib.parse.urlencode({
        "categories": ",".join(GEOAPIFY_CATEGORIES[category]),
        "filter": f"circle:{longitude},{latitude},{radius_m}",
        "bias": f"proximity:{longitude},{latitude}",
        "limit": 100,
        "lang": "en",
        "apiKey": GEOAPIFY_API_KEY,
    })
    request = urllib.request.Request(
        f"{GEOAPIFY_PLACES_URL}?{params}",
        headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=PLACES_TIMEOUT_SECONDS) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        logger.warning("Geoapify Places returned HTTP %s", exc.code)
        if exc.code in (401, 403):
            message = "Geoapify rejected the API key. Check GEOAPIFY_API_KEY and its permissions."
        elif exc.code == 429:
            message = "Geoapify usage limit reached. Check your daily quota and billing settings."
        else:
            message = f"Geoapify Places returned HTTP {exc.code}."
        raise LocationServiceError(message) from exc
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, UnicodeDecodeError, OSError) as exc:
        logger.warning("Geoapify Places request failed: %s", exc)
        raise LocationServiceError(
            "Geoapify nearby-business lookup failed due to a connection or response error."
        ) from exc

    features = payload.get("features", [])
    unique_businesses = {}
    for feature in features:
        properties = feature.get("properties", {}) or {}
        geometry = feature.get("geometry", {}) or {}
        coordinates = geometry.get("coordinates") or []
        business_longitude = properties.get("lon")
        business_latitude = properties.get("lat")
        if (business_latitude is None or business_longitude is None) and len(coordinates) >= 2:
            business_longitude, business_latitude = coordinates[0], coordinates[1]
        if business_latitude is None or business_longitude is None:
            continue

        name = properties.get("name") or properties.get("address_line1")
        if not name:
            continue
        business_latitude = float(business_latitude)
        business_longitude = float(business_longitude)
        distance_m = _haversine_distance_m(
            latitude, longitude, business_latitude, business_longitude
        )
        if distance_m > radius_m:
            continue

        place_id = properties.get("place_id") or properties.get("datasource", {}).get("raw", {}).get("id")
        if place_id is None:
            place_id = f"{business_latitude:.6f},{business_longitude:.6f}:{name}"
        categories = properties.get("categories") or []
        display_category = next(
            (str(item).split(".")[-1].replace("_", " ").title() for item in categories),
            category.title(),
        )
        unique_businesses[str(place_id)] = {
            # Keep legacy field names so the existing React UI needs no changes.
            "osm_id": str(place_id),
            "osm_type": "geoapify",
            "name": name,
            "category": display_category,
            "address": properties.get("formatted") or properties.get("address_line2") or "Address not listed",
            "latitude": business_latitude,
            "longitude": business_longitude,
            "distance_m": round(distance_m),
            "distance_km": round(distance_m / 1000, 2),
            "source": "Geoapify",
        }

    competitors = sorted(unique_businesses.values(), key=lambda item: item["distance_m"])
    result = {
        "business_category_searched": category,
        "radius_m": radius_m,
        "competitors": competitors,
        "competition_summary": _competition_summary(competitors, radius_m),
        "data_limitations": [
            "Results are limited to places indexed by Geoapify and its data sources.",
            "Some businesses may be missing, unnamed, or incorrectly categorized.",
            "Distances are straight-line estimates, not road distances.",
            "Competitor counts alone do not establish actual demand or revenue loss.",
        ],
        "source": "Geoapify Places API",
    }
    _cache_set(cache_key, result, BUSINESS_CACHE_TTL)
    return result

