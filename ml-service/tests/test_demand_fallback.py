"""
Unit tests for ML demand-prediction fallbacks.

Fallback cases covered:
  1. Retailer with NO sales history -> graceful empty prediction list.
  2. Product with < 2 sale days -> "avg" forecast (mean qty * horizon), not a
     linear-regression with too little data.
  3. Predictions always bounded >= 1 (never negative/zero demand).
"""
import os

import pandas as pd
import pytest

from scripts import model_store
from scripts.demand import _fit_product, get_demand_predictions


@pytest.fixture(autouse=True)
def _empty_store(monkeypatch, tmp_path):
    """Redirect model artifacts to a temp dir (empty = no persisted models)."""
    monkeypatch.setattr(model_store, 'MODELS_DIR', str(tmp_path))
    monkeypatch.setattr(model_store, 'DEMAND_DIR', os.path.join(str(tmp_path), 'demand'))
    os.makedirs(model_store.DEMAND_DIR, exist_ok=True)


def _save_demand(retailer_id, models, names, trained=True):
    import datetime
    model_store.save_artifact(
        model_store.demand_path(retailer_id),
        {'models': models, 'names': names},
        {
            'trained': trained,
            'trained_at': datetime.datetime.now().isoformat(timespec='seconds'),
            'retailer_id': int(retailer_id),
            'samples': 0,
            'products': len(models),
            'horizon_days': 7,
        },
        {'trained': trained, 'mae': None, 'mae_products': 0},
    )


class FakeConn:
    pass


def test_retailer_with_no_sales_returns_empty_list():
    """A retailer with zero sales history => predictions == [] (graceful)."""
    retailer_id = 77
    _save_demand(retailer_id, {}, {})
    preds, computed = get_demand_predictions(FakeConn(), retailer_id)
    assert preds == []
    assert computed is False


def test_retailer_with_no_model_artifact_returns_empty(monkeypatch):
    """No artifact at all for a retailer => [] (missing-model fallback)."""
    empty = pd.DataFrame(columns=['product_id', 'name', 'sale_date', 'qty'])
    monkeypatch.setattr('pandas.read_sql', lambda query, conn, params=None: empty)
    preds, computed = get_demand_predictions(FakeConn(), retailer_id=4242)
    assert preds == []
    assert computed is True  # it created an empty model on demand


def test_single_sale_day_uses_average_fallback_not_regression():
    """<2 days of data -> avg-based forecast, never linear regression."""
    group = pd.DataFrame({
        'sale_date': pd.to_datetime(['2026-01-05']),
        'qty': [4],
    })
    spec = _fit_product(group, horizon_days=7)
    assert spec['kind'] == 'avg'
    assert spec['avg'] == pytest.approx(4.0)


def test_two_sale_days_uses_regression():
    group = pd.DataFrame({
        'sale_date': pd.to_datetime(['2026-01-05', '2026-01-06']),
        'qty': [2, 4],
    })
    spec = _fit_product(group, horizon_days=7)
    assert spec['kind'] == 'reg'
    assert spec['last_idx'] == 2


def test_predictions_never_negative_and_bounded(monkeypatch, tmp_path):
    """Even a sharply-declining trend is clipped to a floor of 1 per horizon."""
    import numpy as np
    from sklearn.linear_model import LinearRegression

    # Declining series: y = 10, 9, 8, ... -> negative slope, forecasts trend down.
    X = np.arange(1, 5).reshape(-1, 1)
    y = np.array([10, 8, 6, 4])
    model = LinearRegression().fit(X, y)

    retailer_id = 55
    models = {
        100: {'kind': 'avg', 'avg': 1.0},
        101: {'kind': 'reg', 'model': model, 'last_idx': 4},
    }
    names = {100: 'Widget', 101: 'Gadget'}
    _save_demand(retailer_id, models, names)

    preds, _ = get_demand_predictions(FakeConn(), retailer_id)
    assert len(preds) == 2
    assert all(p['predicted_demand'] >= 1 for p in preds)