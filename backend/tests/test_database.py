
import pytest

from backend.app.database import (
    create_business,
    get_business,
    init_db,
    list_analyses,
    list_businesses,
    save_analysis,
)


@pytest.fixture
def db_path(tmp_path):
    """Give each test its own temporary SQLite database."""
    path = tmp_path / "venturespot_test.db"
    init_db(path)
    return path


@pytest.fixture
def sample_inputs():
    return {
        "customers_per_day": 10,
        "operating_days_per_month": 20,
        "price_per_customer": 250,
        "variable_cost_per_customer": 90,
        "fixed_cost_per_month": 10000,
        "startup_investment": 15000,
        "available_capital": 30000,
    }


def test_create_and_get_business(db_path, sample_inputs):
    business = create_business(
        "Demo Car Wash",
        sample_inputs,
        db_path,
    )

    assert business["id"] > 0
    assert business["name"] == "Demo Car Wash"
    assert business["inputs"] == sample_inputs
    assert "created_at" in business

    retrieved = get_business(business["id"], db_path)

    assert retrieved is not None
    assert retrieved["name"] == "Demo Car Wash"
    assert retrieved["inputs"] == sample_inputs


def test_list_businesses(db_path, sample_inputs):
    create_business("Business One", sample_inputs, db_path)
    create_business("Business Two", sample_inputs, db_path)

    businesses = list_businesses(db_path)

    assert len(businesses) == 2
    assert {item["name"] for item in businesses} == {
        "Business One",
        "Business Two",
    }


def test_get_missing_business_returns_none(db_path):
    assert get_business(9999, db_path) is None


def test_business_name_cannot_be_empty(db_path, sample_inputs):
    with pytest.raises(ValueError, match="cannot be empty"):
        create_business("   ", sample_inputs, db_path)


def test_save_and_list_analysis_history(db_path, sample_inputs):
    business = create_business(
        "Demo Car Wash",
        sample_inputs,
        db_path,
    )

    results = {
        "monthly_revenue": 50000,
        "operating_profit": 22000,
        "profit_margin_percent": 44,
    }

    saved = save_analysis(
        business["id"],
        "financial",
        sample_inputs,
        results,
        db_path,
    )

    assert saved["id"] > 0
    assert saved["business_id"] == business["id"]
    assert saved["analysis_type"] == "financial"
    assert saved["inputs"] == sample_inputs
    assert saved["results"] == results

    history = list_analyses(business["id"], db_path)

    assert len(history) == 1
    assert history[0]["results"]["operating_profit"] == 22000


def test_cannot_save_analysis_for_missing_business(
    db_path,
    sample_inputs,
):
    with pytest.raises(ValueError, match="does not exist"):
        save_analysis(
            9999,
            "financial",
            sample_inputs,
            {"operating_profit": 22000},
            db_path,
        )


def test_business_list_starts_empty(db_path):
    assert list_businesses(db_path) == []
