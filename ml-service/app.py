"""
ShopWise 360 - ML Microservice
Serves:
  GET  /recommend?customer_id=X       -> content/popularity-based product recommendations
  GET  /predict-demand?retailer_id=X  -> per-product demand forecast for next 7 days
  GET  /model-health                  -> persisted model status + evaluation metrics
  POST /retrain                       -> force (re)build of persisted models
"""
import os
from flask import Flask, request, jsonify
from flask_cors import CORS
import mysql.connector
from dotenv import load_dotenv

from scripts.recommend import get_recommendations, train_recommend_model
from scripts.demand import get_demand_predictions, train_demand_model
from scripts import model_store

load_dotenv()

app = Flask(__name__)
CORS(app)


def get_db_connection():
    return mysql.connector.connect(
        host=os.getenv('DB_HOST', 'localhost'),
        user=os.getenv('DB_USER', 'root'),
        password=os.getenv('DB_PASSWORD', ''),
        database=os.getenv('DB_NAME', 'shopwise360')
    )


def _with_computed(resp, computed):
    resp.headers.add('X-ML-Computed', 'true' if computed else 'false')
    return resp


@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'})


@app.route('/recommend', methods=['GET'])
def recommend():
    customer_id = request.args.get('customer_id')
    if not customer_id:
        return jsonify({'error': 'customer_id is required'}), 400
    try:
        conn = get_db_connection()
        recs, computed = get_recommendations(conn, int(customer_id))
        conn.close()
        return _with_computed(jsonify(recs), computed)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/predict-demand', methods=['GET'])
def predict_demand():
    retailer_id = request.args.get('retailer_id')
    if not retailer_id:
        return jsonify({'error': 'retailer_id is required'}), 400
    try:
        conn = get_db_connection()
        preds, computed = get_demand_predictions(conn, int(retailer_id))
        conn.close()
        return _with_computed(jsonify(preds), computed)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


def _list_retailer_ids(conn):
    cursor = conn.cursor()
    cursor.execute(
        "SELECT DISTINCT retailer_id FROM sales_transactions "
        "UNION SELECT DISTINCT retailer_id FROM inventory"
    )
    ids = sorted({row[0] for row in cursor.fetchall() if row[0] is not None})
    cursor.close()
    return ids


@app.route('/retrain', methods=['POST'])
def retrain():
    body = request.get_json(silent=True) or {}
    target = (request.args.get('target') or body.get('target') or 'all').lower()
    retailer_id = request.args.get('retailer_id') or body.get('retailer_id')
    if target not in ('recommend', 'demand', 'all'):
        return jsonify({'error': "target must be one of: recommend, demand, all"}), 400

    conn = get_db_connection()
    try:
        trained = {}
        if target in ('recommend', 'all'):
            bundle = train_recommend_model(conn)
            trained['recommend'] = {
                'trained': True,
                'meta': bundle['meta'],
                'metrics': bundle['metrics'],
                'path': model_store.recommend_path(),
            }

        if target in ('demand', 'all'):
            if retailer_id:
                bundle = train_demand_model(conn, int(retailer_id))
                trained['demand'] = {
                    'trained': True,
                    'meta': bundle['meta'],
                    'metrics': bundle['metrics'],
                    'path': model_store.demand_path(int(retailer_id)),
                }
            else:
                # Retrain every retailer that has any sales/inventory history.
                trained['demand'] = []
                for rid in _list_retailer_ids(conn):
                    bundle = train_demand_model(conn, rid)
                    trained['demand'].append({
                        'retailer_id': rid,
                        'meta': bundle['meta'],
                        'metrics': bundle['metrics'],
                        'path': model_store.demand_path(rid),
                    })
        return jsonify({'status': 'ok', 'trained': trained})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()


@app.route('/model-health', methods=['GET'])
def model_health():
    try:
        rec_info = model_store.artifact_info(model_store.recommend_path())
        demand_info = {
            'paths': [
                os.path.relpath(p, model_store.MODELS_DIR).replace(os.sep, '/')
                for p in model_store.demand_files()
            ],
            'models': model_store.demand_status(),
        }
        return jsonify({
            'recommend': rec_info,
            'demand': demand_info,
            'max_age_seconds': model_store.MODEL_MAX_AGE_SECONDS,
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    port = int(os.getenv('ML_PORT', 6000))
    app.run(host='0.0.0.0', port=port, debug=False, threaded=True)