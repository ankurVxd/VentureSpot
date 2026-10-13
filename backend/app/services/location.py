
import copy
import json
import logging
import math
import threading
import time
import urllib.error
import urllib.parse
import urllib.request

logger = logging.getLogger(__name__)

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"

OVERPASS_URLS = [
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter",
]

USER_AGENT = "VentureSpot/1.0 (local business location research)"

# Keep network waits short. Public services can still be slow or unavailable.
GEOCODING_TIMEOUT_SECONDS = 10
OVERPASS_TIMEOUT_SECONDS = 30

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


def _post_json(url, data, timeout=OVERPASS_TIMEOUT_SECONDS):
    request = urllib.request.Request(
        url,
        data=data.encode("utf-8"),
        headers={
            "User-Agent": USER_AGENT,
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))

    except urllib.error.HTTPError as exc:
        logger.warning("Overpass returned HTTP %s: %s", exc.code, url)
        raise LocationServiceError(
            f"Nearby-business server returned HTTP {exc.code}."
        ) from exc

    except (
        urllib.error.URLError,
        TimeoutError,
        json.JSONDecodeError,
        UnicodeDecodeError,
        OSError,
    ) as exc:
        logger.warning("Overpass request failed for %s: %s", url, exc)
        raise LocationServiceError(
            "Nearby-business server connection or response failed."
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



def _build_overpass_query(
    latitude: float,
    longitude: float,
    radius_m: int,
    category: str,
) -> str:
    """Build a compact Overpass query using fewer selectors."""

    around = f"(around:{radius_m},{latitude},{longitude});"

    category_queries = {
        "cafe": [
            'nwr["amenity"="cafe"]' + around,
        ],
        "restaurant": [
            'nwr["amenity"~"^(restaurant|fast_food)$"]' + around,
        ],
        "bakery": [
            'nwr["shop"="bakery"]' + around,
        ],
        "grocery": [
            'nwr["shop"~"^(supermarket|convenience|grocery)$"]' + around,
        ],
        "salon": [
            'nwr["shop"~"^(hairdresser|beauty)$"]' + around,
        ],
        "pharmacy": [
            'nwr["amenity"="pharmacy"]' + around,
            'nwr["shop"="chemist"]' + around,
        ],
        "gym": [
            'nwr["leisure"="fitness_centre"]' + around,
            'nwr["amenity"="gym"]' + around,
        ],
        "clothing": [
            'nwr["shop"~"^(clothes|fashion)$"]' + around,
        ],
        "general": [
            'nwr["shop"]' + around,
            'nwr["amenity"~"^(cafe|restaurant|fast_food|pharmacy)$"]' + around,
            'nwr["leisure"="fitness_centre"]' + around,
        ],
    }

    selectors = category_queries[category]

    return (
        "[out:json][timeout:25];"
        "("
        + "".join(selectors)
        + ");"
        "out center tags;"
    )



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


def _get_coordinates(element: dict):
    if element.get("lat") is not None and element.get("lon") is not None:
        return float(element["lat"]), float(element["lon"])

    center = element.get("center", {})

    if center.get("lat") is not None and center.get("lon") is not None:
        return float(center["lat"]), float(center["lon"])

    return None


def _format_address(tags: dict) -> str:
    if tags.get("addr:full"):
        return tags["addr:full"]

    street = tags.get("addr:street", "")
    house_number = tags.get("addr:housenumber", "")

    locality = (
        tags.get("addr:suburb")
        or tags.get("addr:neighbourhood")
        or tags.get("addr:city")
        or tags.get("addr:town")
        or tags.get("addr:village")
        or ""
    )

    postcode = tags.get("addr:postcode", "")
    parts = []

    street_address = " ".join(
        part for part in (house_number, street) if part
    )

    if street_address:
        parts.append(street_address)

    if locality:
        parts.append(locality)

    if postcode:
        parts.append(postcode)

    return ", ".join(parts) or "Address not listed in OpenStreetMap"


def _detect_business_type(tags: dict) -> str:
    for key in ("amenity", "shop", "leisure", "office", "craft"):
        if tags.get(key):
            return str(tags[key]).replace("_", " ").title()

    return "Business"


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
        raise ValueError(
            "Search radius must be between 100 and 5000 metres."
        )

    # Round coordinates slightly to improve cache reuse without materially
    # changing the search location.
    cache_key = (
        "businesses",
        round(latitude, 5),
        round(longitude, 5),
        radius_m,
        category,
    )

    cached = _cache_get(cache_key)

    if cached is not None:
        logger.info("Nearby-business cache hit")
        return cached

    query = _build_overpass_query(
        latitude=latitude,
        longitude=longitude,
        radius_m=radius_m,
        category=category,
    )
    payload = urllib.parse.urlencode({"data": query})

    response = None
    errors = []

    # Keep the existing fallback behavior, but each attempt has a shorter
    # client timeout than the previous implementation.
    for endpoint in OVERPASS_URLS:
        try:
            response = _post_json(endpoint, payload)
            break
        except LocationServiceError as exc:
            errors.append(f"{endpoint}: {exc}")
            logger.warning("Overpass fallback: %s", exc)

    if response is None:
        raise LocationServiceError(
            "All nearby-business servers failed. " + " | ".join(errors)
        )

    elements = response.get("elements", [])
    unique_businesses = {}

    for element in elements:
        tags = element.get("tags", {})
        name = tags.get("name")

        # Ignore unnamed locations, as in the previous implementation.
        if not name:
            continue

        coordinates = _get_coordinates(element)

        if not coordinates:
            continue

        business_latitude, business_longitude = coordinates

        distance_m = _haversine_distance_m(
            latitude,
            longitude,
            business_latitude,
            business_longitude,
        )

        if distance_m > radius_m:
            continue

        osm_type = element.get("type", "unknown")
        osm_id = element.get("id")

        if osm_id is None:
            continue

        unique_key = f"{osm_type}/{osm_id}"

        unique_businesses[unique_key] = {
            "osm_id": osm_id,
            "osm_type": osm_type,
            "name": name,
            "category": _detect_business_type(tags),
            "address": _format_address(tags),
            "latitude": business_latitude,
            "longitude": business_longitude,
            "distance_m": round(distance_m),
            "distance_km": round(distance_m / 1000, 2),
            "source": "OpenStreetMap",
        }

    competitors = sorted(
        unique_businesses.values(),
        key=lambda item: item["distance_m"],
    )

    result = {
        "business_category_searched": category,
        "radius_m": radius_m,
        "competitors": competitors,
        "competition_summary": _competition_summary(
            competitors, radius_m
        ),
        "data_limitations": [
            "Only businesses mapped in OpenStreetMap can be found.",
            "Some businesses may be missing, unnamed, or incorrectly tagged.",
            "Distances are straight-line estimates, not road distances.",
            "Competitor counts alone do not establish actual demand or revenue loss.",
        ],
        "source": "OpenStreetMap Overpass API",
    }

    _cache_set(cache_key, result, BUSINESS_CACHE_TTL)
    return result
