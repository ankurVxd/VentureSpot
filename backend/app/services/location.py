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


# Map UI subcategories to the most specific Geoapify taxonomy available.
# Where Geoapify has no exact taxonomy key, use the closest parent category
# and explicitly disclose that the match is category-based, not verified.
SUBCATEGORY_GEOAPIFY_CATEGORIES = {
    "specialty coffee shop": ["catering.cafe.coffee"],
    "tea shop": ["catering.cafe.tea", "commercial.food_and_drink.coffee_and_tea"],
    "juice bar": ["catering.cafe", "commercial.food_and_drink.drinks"],
    "bubble tea shop": ["catering.cafe.bubble_tea"],
    "dessert café": ["catering.cafe.dessert"],
    "internet café": ["catering.cafe"],
    "fast food": ["catering.fast_food"],
    "fine dining": ["catering.restaurant"],
    "family restaurant": ["catering.restaurant"],
    "casual dining": ["catering.restaurant"],
    "south indian": ["catering.restaurant.indian"],
    "north indian": ["catering.restaurant.indian"],
    "chinese": ["catering.restaurant.chinese"],
    "pizza": ["catering.restaurant.pizza", "catering.fast_food.pizza"],
    "biryani": ["catering.restaurant.indian"],
    "street food": ["catering.fast_food"],
    "cloud kitchen": ["catering.restaurant", "catering.fast_food"],
    "cake shop": ["commercial.food_and_drink.bakery", "catering.cafe.cake"],
    "pastry shop": ["commercial.food_and_drink.bakery", "catering.cafe.cake"],
    "bread bakery": ["commercial.food_and_drink.bakery"],
    "custom cake studio": ["commercial.food_and_drink.bakery", "catering.cafe.cake"],
    "cookies & confectionery": ["commercial.food_and_drink.confectionery"],
    "donut shop": ["catering.cafe.donut"],
    "supermarket": ["commercial.supermarket"],
    "mini-mart": ["commercial.convenience"],
    "convenience store": ["commercial.convenience"],
    "organic grocery": ["commercial.food_and_drink.organic"],
    "fruit & vegetable shop": ["commercial.food_and_drink.fruit_and_vegetable"],
    "dairy shop": ["commercial.food_and_drink.cheese_and_dairy"],
    "wholesale grocery": ["commercial.supermarket", "commercial.food_and_drink"],
    "hair salon": ["commercial.hairdresser"],
    "barbershop": ["commercial.hairdresser"],
    "beauty parlour": ["commercial.beauty"],
    "nail salon": ["commercial.beauty"],
    "spa": ["healthcare", "commercial.beauty"],
    "bridal makeup studio": ["commercial.beauty"],
    "unisex salon": ["commercial.hairdresser", "commercial.beauty"],
    "retail medical store": ["healthcare.pharmacy"],
    "generic medicine store": ["healthcare.pharmacy", "commercial.chemist"],
    "ayurvedic store": ["healthcare.pharmacy", "commercial.chemist"],
    "surgical supplies": ["healthcare", "commercial.chemist"],
    "medical equipment store": ["healthcare", "commercial.chemist"],
    "traditional gym": ["leisure.fitness_centre", "sport.fitness"],
    "personal training studio": ["leisure.fitness_centre", "sport.fitness"],
    "yoga studio": ["sport"],
    "pilates studio": ["sport.fitness"],
    "crossfit studio": ["leisure.fitness_centre", "sport.fitness"],
    "martial arts academy": ["sport"],
    "dance fitness studio": ["sport"],
    "men's wear": ["commercial.clothing.men"],
    "women's wear": ["commercial.clothing.women"],
    "kids' wear": ["commercial.clothing.kids"],
    "ethnic wear": ["commercial.clothing"],
    "sportswear": ["commercial.clothing.sport"],
    "footwear": ["commercial.clothing.shoes"],
    "boutique": ["commercial.clothing"],
    "accessories & bags": ["commercial.clothing.accessories", "commercial.bag"],
    "electronics store": ["commercial.elektronics"],
    "mobile phone shop": ["commercial.elektronics"],
    "computer store": ["commercial.elektronics"],
    "stationery shop": ["commercial"],
    "gift shop": ["commercial"],
    "home décor": ["commercial.furniture_and_interior"],
    "furniture store": ["commercial.furniture_and_interior"],
    "hardware store": ["commercial"],
    "toy shop": ["commercial"],
    "pet supplies": ["commercial"],
    "bookstore": ["commercial.books"],
    "coworking space": ["office"],
    "shared office": ["office"],
    "private office rental": ["office.coworking", "office"],
    "business centre": ["office.coworking", "office"],
    "laundry": ["service"],
    "dry cleaning": ["service"],
    "ironing service": ["service"],
    "home cleaning": ["service"],
    "car repair": ["service.vehicle"],
    "two-wheeler repair": ["service.vehicle"],
    "car wash": ["service.vehicle"],
    "tyre shop": ["commercial", "service.vehicle"],
    "auto parts": ["commercial.vehicle"],
    "coaching classes": ["education"],
    "computer training": ["education"],
    "language institute": ["education"],
    "music school": ["education"],
    "skill development centre": ["education"],
}

CATEGORY_FALLBACKS = {
    "cafe": ["catering.cafe"],
    "restaurant": ["catering.restaurant", "catering.fast_food", "catering.food_court"],
    "bakery": ["commercial.food_and_drink.bakery", "catering.cafe.cake"],
    "grocery": ["commercial.supermarket", "commercial.convenience", "commercial.food_and_drink"],
    "salon": ["commercial.hairdresser", "commercial.beauty"],
    "pharmacy": ["healthcare.pharmacy", "commercial.chemist"],
    "gym": ["leisure.fitness_centre", "sport.fitness", "sport"],
    "clothing": ["commercial.clothing"],
    "general": ["commercial", "catering", "healthcare.pharmacy", "leisure.fitness_centre"],
    "office_coworking": ["office.coworking", "office"],
    "laundry_cleaning": ["service"],
    "automotive": ["service.vehicle", "commercial.vehicle"],
    "education": ["education"],
}

FOOD_PREFERENCE_CONDITIONS = {
    "pure veg": ["vegetarian.only"],
    "vegan-friendly": ["vegan"],
    "jain-friendly": ["vegetarian.only"],
}

def _geoapify_request(latitude, longitude, radius_m, categories, conditions=None):
    params = {
        "categories": ",".join(categories),
        "filter": f"circle:{longitude},{latitude},{radius_m}",
        "bias": f"proximity:{longitude},{latitude}",
        "limit": 100,
        "lang": "en",
        "apiKey": GEOAPIFY_API_KEY,
    }
    if conditions:
        params["conditions"] = ",".join(conditions)
    query = urllib.parse.urlencode(params)
    request = urllib.request.Request(
        f"{GEOAPIFY_PLACES_URL}?{query}",
        headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=PLACES_TIMEOUT_SECONDS) as response:
            return json.loads(response.read().decode("utf-8"))
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

def find_nearby_businesses(
    latitude: float,
    longitude: float,
    radius_m: int = 1000,
    category: str = "cafe",
    subcategory: str | None = None,
    food_preference: str | None = None,
) -> dict:
    """Find relevant nearby places with Geoapify's category taxonomy and conditions."""
    category = category.strip().lower()
    subcategory = (subcategory or "").strip()
    food_preference = (food_preference or "").strip()

    if category not in SUPPORTED_CATEGORIES:
        raise ValueError("Unsupported category. Choose from: " + ", ".join(sorted(SUPPORTED_CATEGORIES)))
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

    allowed_food_preferences = {
        "pure veg", "non-veg", "veg & non-veg", "vegan-friendly", "jain-friendly"
    }
    if food_preference and food_preference.casefold() not in allowed_food_preferences:
        raise ValueError("Unsupported food preference.")
    if food_preference and category not in {"cafe", "restaurant"}:
        raise ValueError("Food preference can only be used with cafes and restaurants.")

    normalized_subcategory = subcategory.casefold()
    subcategory_categories = SUBCATEGORY_GEOAPIFY_CATEGORIES.get(normalized_subcategory)
    categories = subcategory_categories or CATEGORY_FALLBACKS.get(category, GEOAPIFY_CATEGORIES.get(category, ["commercial"]))
    conditions = FOOD_PREFERENCE_CONDITIONS.get(food_preference.casefold())
    # Non-veg and mixed menus have no reliable negative filter in Geoapify.
    # Never infer non-veg from the absence of a vegetarian tag.
    cache_key = (
        "geoapify-enhanced",
        round(latitude, 5), round(longitude, 5), radius_m,
        category, normalized_subcategory, food_preference.casefold(),
    )
    cached = _cache_get(cache_key)
    if cached is not None:
        logger.info("Nearby-business cache hit (Geoapify enhanced)")
        return cached

    payload = _geoapify_request(latitude, longitude, radius_m, categories, conditions)
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
        business_latitude, business_longitude = float(business_latitude), float(business_longitude)
        distance_m = _haversine_distance_m(latitude, longitude, business_latitude, business_longitude)
        if distance_m > radius_m:
            continue
        place_id = properties.get("place_id") or properties.get("datasource", {}).get("raw", {}).get("id")
        if place_id is None:
            place_id = f"{business_latitude:.6f},{business_longitude:.6f}:{name}"
        place_categories = properties.get("categories") or []
        display_category = next(
            (str(item).split(".")[-1].replace("_", " ").title() for item in place_categories),
            category.replace("_", " ").title(),
        )
        vegetarian_tag = any(
            str(tag).casefold() in {"vegetarian", "vegetarian.only", "vegan", "vegan.only"}
            for tag in place_categories
        )
        if food_preference.casefold() == "pure veg":
            classification = "Tagged vegetarian-only" if "vegetarian.only" in [str(t).casefold() for t in place_categories] else "Returned by vegetarian-only filter"
        elif food_preference.casefold() == "vegan-friendly":
            classification = "Vegan tag/filter match"
        elif food_preference.casefold() == "jain-friendly":
            classification = "Vegetarian match; Jain suitability unverified"
        elif food_preference.casefold() == "non-veg":
            classification = "Unknown — menu not verified"
        elif food_preference.casefold() == "veg & non-veg":
            classification = "Unknown — mixed menu not verified"
        else:
            classification = "Vegetarian tag available" if vegetarian_tag else "Unknown"
        unique_businesses[str(place_id)] = {
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
            "matched_categories": place_categories,
            "food_classification": classification,
        }

    competitors = sorted(unique_businesses.values(), key=lambda item: item["distance_m"])
    limitations = [
        "Results are limited to places indexed by Geoapify and its data sources.",
        "Subcategories use Geoapify's closest available taxonomy; some labels do not have an exact provider category.",
        "Some businesses may be missing, unnamed, or incorrectly categorized.",
        "Distances are straight-line estimates, not road distances.",
        "Competitor counts alone do not establish actual demand or revenue loss.",
    ]
    if food_preference.casefold() in {"non-veg", "veg & non-veg"}:
        limitations.append("Geoapify does not reliably identify non-vegetarian or mixed-menu businesses; these results are not verified by menu.")
    if food_preference.casefold() == "jain-friendly":
        limitations.append("A vegetarian tag does not prove Jain preparation, separate utensils, or no root vegetables.")
    result = {
        "business_category_searched": category,
        "business_subcategory_searched": subcategory or None,
        "food_preference_searched": food_preference or None,
        "geoapify_categories_used": categories,
        "geoapify_conditions_used": conditions or [],
        "subcategory_match_method": "Geoapify subcategory taxonomy" if subcategory_categories else ("main-category fallback" if subcategory else "main category"),
        "radius_m": radius_m,
        "competitors": competitors,
        "competition_summary": _competition_summary(competitors, radius_m),
        "data_limitations": limitations,
        "source": "Geoapify Places API",
    }
    _cache_set(cache_key, result, BUSINESS_CACHE_TTL)
    return result

