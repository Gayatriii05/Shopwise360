"""
Demand prediction engine (persisted models).

Approach: per-product linear regression on daily sales history
(day-index as feature, quantity sold as target) using scikit-learn's
LinearRegression. The fitted models are persisted with joblib per retailer;
reads serve the stored model without refitting, and a discarded/lazy retrain
only happens when the artifact is missing or older than MODEL_MAX_AGE_SECONDS.

Evaluation: MAE via a last-day holdout — for every product with >= 3 sale
days, the final day is held out, the model is fit on the rest, and the
absolute error on that held-out day is recorded. The mean is reported as the
(model-level) demand MAE.
"""
import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression

from . import model_store


def fetch_sales_df(conn, retailer_id):
    query = """
        SELECT st.product_id, p.name, DATE(st.sold_at) AS sale_date, SUM(st.quantity) AS qty
        FROM sales_transactions st
        JOIN products p ON st.product_id = p.id
        WHERE st.retailer_id = %s
        GROUP BY st.product_id, p.name, DATE(st.sold_at)
        ORDER BY st.product_id, sale_date
    """
    return pd.read_sql(query, conn, params=(retailer_id,))


def _fit_product(group, horizon_days):
    """Fit (or fall back) for a single product series; returns prediction helper."""
    group = group.sort_values('sale_date').reset_index(drop=True)
    if len(group) < 2:
        return {'kind': 'avg', 'avg': float(group['qty'].mean())}
    group['day_index'] = np.arange(len(group))
    X = group[['day_index']].values
    y = group['qty'].values
    model = LinearRegression()
    model.fit(X, y)
    return {
        'kind': 'reg',
        'model': model,
        'last_idx': int(len(group)),
    }


def _holdout_mae(group):
    """Last-day holdout absolute error for one product series, or None."""
    group = group.sort_values('sale_date').reset_index(drop=True)
    if len(group) < 3:
        return None
    train = group.iloc[:-1].copy()
    test = group.iloc[-1:].copy()
    train['day_index'] = np.arange(len(train))
    X = train[['day_index']].values
    model = LinearRegression().fit(X, train['qty'].values)
    pred = float(model.predict([[len(train)]])[0])
    actual = float(test['qty'].iloc[0])
    return abs(pred - actual)


def train_demand_model(conn, retailer_id, horizon_days=7):
    """Fit + persist one retailer's demand models. Returns the saved bundle."""
    df = fetch_sales_df(conn, retailer_id)
    if df.empty:
        meta = {'trained': False, 'trained_at': None, 'retailer_id': int(retailer_id),
                'samples': 0, 'products': 0, 'horizon_days': horizon_days}
        metrics = {'mae': None, 'mae_products': 0, 'trained': False}
        payload = {'models': {}, 'names': {}}
        model_store.save_artifact(model_store.demand_path(retailer_id), payload, meta, metrics)
        return {'payload': payload, 'meta': meta, 'metrics': metrics}

    payload = {'models': {}, 'names': {}}
    mae_values = []
    for product_id, group in df.groupby('product_id'):
        pid = int(product_id)
        name = str(group['name'].iloc[0])
        payload['names'][pid] = name
        payload['models'][pid] = _fit_product(group, horizon_days)
        err = _holdout_mae(group)
        if err is not None:
            mae_values.append(err)

    import datetime
    meta = {
        'trained': True,
        'trained_at': datetime.datetime.now().isoformat(timespec='seconds'),
        'retailer_id': int(retailer_id),
        'samples': int(len(df)),
        'products': int(len(payload['models'])),
        'horizon_days': horizon_days,
    }
    metrics = {
        'trained': True,
        'mae': round(float(np.mean(mae_values)), 3) if mae_values else None,
        'mae_products': len(mae_values),
    }
    model_store.save_artifact(model_store.demand_path(retailer_id), payload, meta, metrics)
    return {'payload': payload, 'meta': meta, 'metrics': metrics}


def _predict_from_bundle(bundle, horizon_days):
    payload = bundle['payload']
    predictions = []
    for pid, spec in payload['models'].items():
        name = payload['names'].get(pid, 'Unknown')
        if spec['kind'] == 'reg':
            future = np.arange(spec['last_idx'], spec['last_idx'] + horizon_days).reshape(-1, 1)
            forecast = np.clip(spec['model'].predict(future), 0, None)
            predicted = max(1, round(float(forecast.sum())))
        else:
            predicted = max(1, round(spec['avg'] * horizon_days))
        predictions.append({
            'product_id': int(pid),
            'name': name,
            'predicted_demand': int(predicted),
            'horizon_days': horizon_days
        })
    predictions.sort(key=lambda x: x['predicted_demand'], reverse=True)
    return predictions


def get_demand_predictions(conn, retailer_id, horizon_days=7, force=False):
    """Serves predictions from the persisted model. Returns (predictions, computed)."""
    path = model_store.demand_path(retailer_id)
    bundle = None if force else model_store.load_artifact(path, allow_fresh_only=True)

    if bundle is None:
        bundle = train_demand_model(conn, retailer_id, horizon_days)
        computed = True
    else:
        computed = False

    if not bundle['payload']['models']:
        return [], computed

    predictions = _predict_from_bundle(bundle, horizon_days)
    return predictions, computed