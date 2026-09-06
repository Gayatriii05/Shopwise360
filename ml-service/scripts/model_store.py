"""
Persistent model store (joblib).

Every trained artifact is saved as a single joblib bundle:
    {"payload": <model payload>, "meta": {...training info...}, "metrics": {...evaluation...}}

Reads are served from disk when the artifact is "fresh" (younger than
MODEL_MAX_AGE_SECONDS). A stale or missing artifact triggers a lazy retrain.
Explicit retrains (admin endpoint) always force a rebuild.
"""
import os
import time

import joblib

MODELS_DIR = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', 'models'))
DEMAND_DIR = os.path.join(MODELS_DIR, 'demand')
RECOMMEND_DIR = os.path.join(MODELS_DIR, 'recommend')

DEFAULT_MAX_AGE_SECONDS = 12 * 3600  # 12h
MODEL_MAX_AGE_SECONDS = int(os.getenv('MODEL_MAX_AGE_SECONDS', str(DEFAULT_MAX_AGE_SECONDS)))

for _d in (DEMAND_DIR, RECOMMEND_DIR):
    os.makedirs(_d, exist_ok=True)


def demand_path(retailer_id):
    return os.path.join(DEMAND_DIR, 'retailer_{}.joblib'.format(int(retailer_id)))


def recommend_path():
    return os.path.join(RECOMMEND_DIR, 'model.joblib')


def demand_files():
    if not os.path.isdir(DEMAND_DIR):
        return []
    return sorted(
        os.path.join(DEMAND_DIR, f) for f in os.listdir(DEMAND_DIR)
        if f.startswith('retailer_') and f.endswith('.joblib')
    )


def demand_status():
    """One status entry per persisted retailer demand model, sorted by retailer id."""
    entries = []
    for path in demand_files():
        info = artifact_info(path, allow_fresh_only=False)
        if not info:
            continue
        try:
            retailer_id = int(os.path.splitext(os.path.basename(path))[0].split('_')[1])
        except (ValueError, IndexError):
            retailer_id = None
        entries.append({'retailer_id': retailer_id, **info})
    entries.sort(key=lambda e: e.get('retailer_id') or 0)
    return entries


def age_seconds(path):
    if not os.path.exists(path):
        return None
    return time.time() - os.path.getmtime(path)


def is_fresh(path, max_age_seconds=MODEL_MAX_AGE_SECONDS):
    age = age_seconds(path)
    return age is not None and age < max_age_seconds


def artifact_exists(path):
    return os.path.exists(path)


def save_artifact(path, payload, meta, metrics):
    bundle = {'payload': payload, 'meta': meta, 'metrics': metrics}
    tmp_path = path + '.tmp'
    joblib.dump(bundle, tmp_path, compress=3)
    os.replace(tmp_path, path)  # atomic-ish on Windows
    return path


def load_artifact(path, allow_fresh_only=True):
    if not os.path.exists(path):
        return None
    if allow_fresh_only and not is_fresh(path):
        return None
    try:
        return joblib.load(path)
    except Exception:
        return None


def artifact_info(path, allow_fresh_only=True):
    """Summarise a saved artifact for the model-health endpoint."""
    if not os.path.exists(path):
        return None
    bundle = load_artifact(path, allow_fresh_only=allow_fresh_only)
    if bundle is None:
        return {
            'path': path,
            'exists': True,
            'age_seconds': age_seconds(path),
            'fresh': is_fresh(path),
            'meta': None,
            'metrics': None,
        }
    return {
        'path': path,
        'exists': True,
        'age_seconds': age_seconds(path),
        'fresh': is_fresh(path),
        'meta': bundle.get('meta'),
        'metrics': bundle.get('metrics'),
    }