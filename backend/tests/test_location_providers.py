from backend.app.services import location


def test_google_text_search_uses_subcategory_and_marks_dietary_unverified(monkeypatch):
    monkeypatch.setattr(location, "GOOGLE_PLACES_API_KEY", "test-key")
    monkeypatch.setattr(location, "GEOAPIFY_API_KEY", "")
    captured = {}

    def fake_google_request(url, payload):
        captured["url"] = url
        captured["payload"] = payload
        return {
            "places": [{
                "id": "test-place-id",
                "displayName": {"text": "Example Biryani House"},
                "formattedAddress": "Example Road, Pune",
                "location": {"latitude": 18.599, "longitude": 73.763},
                "primaryType": "restaurant",
                "types": ["restaurant", "food"],
                "googleMapsUri": "https://maps.google.com/?q=example",
            }]
        }

    monkeypatch.setattr(location, "_google_request", fake_google_request)
    result = location.find_nearby_businesses(
        latitude=18.6,
        longitude=73.76,
        radius_m=1000,
        category="restaurant",
        subcategory="Biryani",
        food_preference="non_veg",
    )

    assert "searchText" in captured["url"]
    assert "Biryani" in captured["payload"]["textQuery"]
    assert "non vegetarian" in captured["payload"]["textQuery"]
    assert result["source"] == "Google Places API (New)"
    assert result["competitors"][0]["dietary_status"] == "unverified"


def test_google_nearby_search_uses_main_category_type(monkeypatch):
    monkeypatch.setattr(location, "GOOGLE_PLACES_API_KEY", "test-key")
    monkeypatch.setattr(location, "GEOAPIFY_API_KEY", "")
    captured = {}

    def fake_google_request(url, payload):
        captured["url"] = url
        captured["payload"] = payload
        return {"places": []}

    monkeypatch.setattr(location, "_google_request", fake_google_request)
    result = location.find_nearby_businesses(18.6, 73.76, 1000, "restaurant")

    assert "searchNearby" in captured["url"]
    assert captured["payload"]["includedTypes"] == ["restaurant"]
    assert result["query_mode"] == "nearby_search"


def test_invalid_subcategory_is_rejected():
    try:
        location.find_nearby_businesses(18.6, 73.76, 1000, "restaurant", "Not A Real Subcategory")
    except ValueError as exc:
        assert "Unsupported subcategory" in str(exc)
    else:
        raise AssertionError("Expected invalid subcategory to be rejected")
