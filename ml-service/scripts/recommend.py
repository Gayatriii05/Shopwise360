"""
Product recommendation engine (persisted model).

Approach: item-based collaborative filtering using product co-purchase
patterns (customers who bought X also bought Y), falling back to
popularity-based recommendations for customers with no purchase history
(cold start).

The similarity matrix is computed once per training run and persisted with
joblib; reads serve the stored model without rebuilding it. A stale or
missing artifact triggers a lazy retrain.

Evaluation: precision@k via leave-one-out — for every customer who bought at
least 2 distinct products, one product is hidden and we check whether it
appears in the top-k recommendations derived from the others.
"""
import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity

from . import model_store


def build_interaction_matrix(conn):
    query = """
        SELECT o.customer_id, oi.product_id, SUM(oi.quantity) AS qty
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        GROUP BY o.customer_id, oi.product_id
    """
    df = pd.read_sql(query, conn)
    if df.empty:
        return None
    return df.pivot_table(index='customer_id', columns='product_id', values='qty', fill_value=0)


def get_popular_products(conn, limit=5):
    query = """
        SELECT p.id AS product_id, p.name, COALESCE(SUM(oi.quantity), 0) AS total_sold
        FROM products p
        LEFT JOIN order_items oi ON oi.product_id = p.id
        GROUP BY p.id, p.name
        ORDER BY total_sold DESC
        LIMIT %s
    """
    df = pd.read_sql(query, conn, params=(limit,))
    return [
        {'product_id': int(r.product_id), 'name': r.name, 'score': round(float(r.total_sold), 4)}
        for r in df.itertuples()
    ]


def _precision_at_k(matrix, similarity, top_n):
    """Leave-one-out precision@k across customers with >= 2 purchased products."""
    hits = 0
    evaluated = 0
    for customer_id in matrix.index:
        purchased = matrix.loc[customer_id]
        purchased = purchased[purchased > 0]
        if len(purchased) < 2:
            continue
        holdout = purchased.index[0]
        # Recommend using every other purchased product
        keep = [pid for pid in purchased.index if pid != holdout]
        scores = similarity[keep].sum(axis=1)
        scores = scores.drop(labels=keep, errors='ignore')
        top = scores.sort_values(ascending=False).head(top_n)
        evaluated += 1
        if holdout in top.index:
            hits += 1
    return (hits, evaluated)


def train_recommend_model(conn, top_n=5):
    """Fit + persist the global recommend model. Returns the saved bundle."""
    matrix = build_interaction_matrix(conn)
    popular = get_popular_products(conn, 20)
    import datetime
    meta = {
        'trained': True,
        'trained_at': datetime.datetime.now().isoformat(timespec='seconds'),
        'cold_start': matrix is None,
        'customers': 0 if matrix is None else int(matrix.shape[0]),
        'products': 0 if matrix is None else int(matrix.shape[1]),
        'top_n': top_n,
    }
    metrics = {'trained': True, 'precision_at_k': None, 'eval_customers': 0}

    if matrix is None:
        payload = {'similarity': None, 'popular': popular}
        model_store.save_artifact(model_store.recommend_path(), payload, meta, metrics)
        return {'payload': payload, 'meta': meta, 'metrics': metrics}

    item_matrix = matrix.T
    sim = cosine_similarity(item_matrix)
    similarity = pd.DataFrame(sim, index=item_matrix.index, columns=item_matrix.index)

    hits, evaluated = _precision_at_k(matrix, similarity, top_n)
    metrics['precision_at_k'] = round(hits / evaluated, 4) if evaluated else None
    metrics['eval_customers'] = evaluated

    name_query = "SELECT id, name FROM products WHERE id IN ({})".format(
        ','.join(['%s'] * len(similarity.index))
    )
    names_df = pd.read_sql(name_query, conn, params=tuple(int(pid) for pid in similarity.index))
    names = dict(zip(names_df['id'], names_df['name']))

    payload = {'matrix': matrix, 'similarity': similarity, 'popular': popular, 'names': names}
    model_store.save_artifact(model_store.recommend_path(), payload, meta, metrics)
    return {'payload': payload, 'meta': meta, 'metrics': metrics}


def get_recommendations(conn, customer_id, top_n=5, force=False):
    """Serves recommendations from the persisted model. Returns (recs, computed)."""
    bundle = None if force else model_store.load_artifact(model_store.recommend_path(),
                                                          allow_fresh_only=True)

    if bundle is None:
        bundle = train_recommend_model(conn, top_n)
        computed = True
    else:
        computed = False

    payload = bundle['payload']
    matrix = payload.get('matrix')
    similarity = payload.get('similarity')
    popular = payload.get('popular', [])
    names = payload.get('names', {})

    # Cold start / no interaction data -> popularity fallback
    if matrix is None or similarity is None:
        return popular[:top_n], computed

    if customer_id not in matrix.index:
        return popular[:top_n], computed

    customer_purchases = matrix.loc[customer_id]
    purchased = customer_purchases[customer_purchases > 0].index.tolist()
    if not purchased:
        return popular[:top_n], computed

    scores = similarity[purchased].sum(axis=1)
    scores = scores.drop(labels=purchased, errors='ignore')
    scores = scores.sort_values(ascending=False).head(top_n)

    if scores.empty:
        return popular[:top_n], computed

    max_score = scores.max() if scores.max() > 0 else 1
    return [
        {
            'product_id': int(pid),
            'name': names.get(int(pid), 'Unknown'),
            'score': round(float(score) / float(max_score), 4)
        }
        for pid, score in scores.items()
    ], computed