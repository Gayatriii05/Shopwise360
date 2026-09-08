"""
Unit tests for ML cold-start recommender fallback.

Cold start = a customer (or the entire system) has no purchase history.
The recommender must degrade gracefully to a popularity-based list instead
of crashing or returning an empty payload.
"""
import os

import pytest

from scripts import model_store
from scripts.recommend import get_recommendations

POPULAR = [
    {'product_id': 3, 'name': 'Basmati', 'score': 10.0},
    {'product_id': 1, 'name': 'Mouse', 'score': 6.0},
    {'product_id': 2, 'name': 'Speaker', 'score': 2.0},
]


@pytest.fixture(autouse=True)
def _cold_start_store(monkeypatch, tmp_path):
    """Redirect model artifacts to a temp dir and pre-save a cold-start bundle."""
    monkeypatch.setattr(model_store, 'MODELS_DIR', str(tmp_path))
    monkeypatch.setattr(model_store, 'RECOMMEND_DIR', os.path.join(str(tmp_path), 'recommend'))
    os.makedirs(model_store.RECOMMEND_DIR, exist_ok=True)

    # A matrix=None artifact is exactly what the trainer writes on cold start.
    model_store.save_artifact(
        model_store.recommend_path(),
        {'matrix': None, 'similarity': None, 'popular': POPULAR},
        {'trained': True, 'cold_start': True, 'trained_at': '2026-01-01T00:00:00'},
        {'trained': True, 'precision_at_k': None, 'eval_customers': 0},
    )


class NoopConn:
    """The cold-start read path never touches the DB."""


CONN = NoopConn()


def test_no_purchase_history_returns_popularity():
    """matrix is None (no interactions) -> popularity list, not an error."""
    recs, computed = get_recommendations(CONN, customer_id=424242)
    assert isinstance(recs, list)
    assert recs
    assert len(recs) <= 5
    assert recs[0]['product_id'] == 3  # most popular first


def test_unknown_customer_gets_popularity_not_empty():
    """customer not present in interaction matrix -> popularity fallback."""
    recs, _ = get_recommendations(CONN, customer_id=999999)
    assert recs


def test_returns_top_n_bounded():
    recs, _ = get_recommendations(CONN, customer_id=123456, top_n=3)
    assert len(recs) <= 3


def test_empty_popular_store_returns_empty_cleanly():
    """If even the popularity model is empty, return [] without crashing."""
    model_store.save_artifact(
        model_store.recommend_path(),
        {'matrix': None, 'similarity': None, 'popular': []},
        {'trained': True, 'cold_start': True},
        {'trained': True},
    )
    recs, _ = get_recommendations(CONN, customer_id=7)
    assert recs == []