const swaggerJsdoc = require('swagger-jsdoc');

// ---- shared schemas ----

const errorShape = (extra = {}) => ({
  type: 'object',
  properties: { error: { type: 'string', description: 'Human-readable failure reason' }, ...extra },
  required: ['error']
});

const bearer = [{ bearerAuth: [] }];
const publicOp = [];

const security = {
  bearerAuth: {
    type: 'http',
    scheme: 'bearer',
    description: 'Access token issued by POST /api/auth/login or /register (type: access). Send as `Authorization: Bearer <token>`.'
  }
};

const authResponse = {
  description: 'Authenticated session',
  content: {
    'application/json': {
      schema: {
        type: 'object',
        properties: {
          token: { type: 'string' },
          accessToken: { type: 'string' },
          refreshToken: { type: 'string' },
          user: {
            type: 'object',
            properties: {
              id: { type: 'integer' }, name: { type: 'string' },
              email: { type: 'string', format: 'email' },
              role: { type: 'string', enum: ['customer', 'retailer', 'supplier', 'admin'] }
            }
          }
        }
      }
    }
  }
};

const productSchema = {
  type: 'object',
  properties: {
    id: { type: 'integer' }, name: { type: 'string' },
    description: { type: 'string' }, category_id: { type: 'integer', nullable: true },
    supplier_id: { type: 'integer', nullable: true },
    cost_price: { type: 'number' }, sale_price: { type: 'number' },
    image_url: { type: 'string' }, created_at: { type: 'string', format: 'date-time' }
  }
};

const orderItemSchema = {
  type: 'object',
  properties: {
    product_id: { type: 'integer' }, quantity: { type: 'integer', minimum: 1 },
    unit_price: { type: 'number' }, name: { type: 'string' }, image_url: { type: 'string' }
  }
};

// ---- paths ----

const paths = {
  '/api/health': {
    get: {
      tags: ['System'], summary: 'Liveness probe',
      security: publicOp,
      responses: { 200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string' }, time: { type: 'string' } } } } } } }
    }
  },

  '/api/auth/register': {
    post: {
      tags: ['Auth'], summary: 'Register a new user (optional role profile)',
      description: 'Rate-limited (registerLimiter). Creates the user and, for retailer/supplier roles, the matching profile row.',
      security: publicOp,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object', required: ['name', 'email', 'password', 'role'],
              properties: {
                name: { type: 'string', maxLength: 100 },
                email: { type: 'string', format: 'email' },
                password: { type: 'string', minLength: 6 },
                role: { type: 'string', enum: ['customer', 'retailer', 'supplier', 'admin'] },
                extra: {
                  type: 'object', description: 'retailer: {store_name, location} · supplier: {company_name, contact_phone}',
                  properties: {
                    store_name: { type: 'string' }, location: { type: 'string' },
                    company_name: { type: 'string' }, contact_phone: { type: 'string' }
                  }
                }
              }
            }
          }
        }
      },
      responses: {
        201: authResponse,
        400: { description: 'Validation failure', content: { 'application/json': { schema: errorShape({ errors: { type: 'array', items: { type: 'object', properties: { field: { type: 'string' }, msg: { type: 'string' } } } } }) } } },
        409: { description: 'Email already registered', content: { 'application/json': { schema: errorShape() } } },
        429: { description: 'Too many registrations from this IP', content: { 'application/json': { schema: errorShape() } } },
        500: { description: 'Registration failed', content: { 'application/json': { schema: errorShape() } } }
      }
    }
  },
  '/api/auth/login': {
    post: {
      tags: ['Auth'], summary: 'Log in with email + password',
      description: 'Rate-limited (authLimiter, default 20/IP+email per 15 min; AUTH_RATE_MAX in dev). Returns access + refresh token pair.',
      security: publicOp,
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { type: 'object', required: ['email', 'password'], properties: { email: { type: 'string', format: 'email' }, password: { type: 'string' } } } } }
      },
      responses: {
        200: authResponse,
        400: { description: 'Validation failure', content: { 'application/json': { schema: errorShape() } } },
        401: { description: 'Invalid credentials', content: { 'application/json': { schema: errorShape() } } },
        429: { description: 'Too many attempts (burnt out)', content: { 'application/json': { schema: errorShape() } } },
        500: { description: 'Login failed', content: { 'application/json': { schema: errorShape() } } }
      }
    }
  },
  '/api/auth/me': {
    get: {
      tags: ['Auth'], summary: 'Current user profile',
      security: bearer,
      responses: {
        200: { description: 'User profile (retailer/supplier rows + wishlist_count included when relevant)' },
        401: { description: 'No/invalid token', content: { 'application/json': { schema: errorShape() } } },
        404: { description: 'User not found', content: { 'application/json': { schema: errorShape() } } }
      }
    }
  },
  '/api/auth/refresh': {
    post: {
      tags: ['Auth'], summary: 'Rotate a refresh token → new access + refresh pair',
      description: 'Reuse of a revoked/expired/unknown token revokes ALL of the user’s refresh tokens (reuse detection).',
      security: publicOp,
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { type: 'object', required: ['refreshToken'], properties: { refreshToken: { type: 'string' } } } } }
      },
      responses: {
        200: { description: 'Rotated pair', content: { 'application/json': { schema: { type: 'object', properties: { accessToken: { type: 'string' }, refreshToken: { type: 'string' } } } } } },
        401: { description: 'Invalid/revoked token', content: { 'application/json': { schema: errorShape() } } }
      }
    }
  },
  '/api/auth/logout': {
    post: {
      tags: ['Auth'], summary: 'Revoke a refresh token',
      security: publicOp,
      requestBody: {
        content: { 'application/json': { schema: { type: 'object', properties: { refreshToken: { type: 'string' } } } } }
      },
      responses: { 200: { description: 'Logged out', content: { 'application/json': { schema: errorShape() } } } }
    }
  },

  '/api/products': {
    get: {
      tags: ['Products'], summary: 'List products (search/filter/sort/pagination)',
      security: publicOp,
      parameters: [
        { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Match against name/description' },
        { name: 'category_id', in: 'query', schema: { type: 'integer', minimum: 1 } },
        { name: 'supplier_id', in: 'query', schema: { type: 'integer', minimum: 1 } },
        { name: 'min_price', in: 'query', schema: { type: 'number', minimum: 0 } },
        { name: 'max_price', in: 'query', schema: { type: 'number', minimum: 0 } },
        { name: 'sort', in: 'query', schema: { type: 'string', enum: ['newest', 'price_asc', 'price_desc', 'name_asc', 'rating'] } },
        { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1 } },
        { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } }
      ],
      responses: {
        200: {
          description: 'Paginated product list (rating, review_count, category, supplier joined)',
          content: { 'application/json': { schema: { type: 'object', properties: { products: { type: 'array', items: productSchema }, pagination: { type: 'object', properties: { page: { type: 'integer' }, limit: { type: 'integer' }, total: { type: 'integer' }, totalPages: { type: 'integer' } } } } } } }
        },
        400: { description: 'Bad query params', content: { 'application/json': { schema: errorShape() } } },
        500: { description: 'Failed to fetch products', content: { 'application/json': { schema: errorShape() } } }
      }
    },
    post: {
      tags: ['Products'], summary: 'Create product (supplier/admin)',
      description: 'Multipart/form-data with an optional `image` file (jpg/png/webp/gif/avif, ≤2MB).',
      security: bearer,
      requestBody: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object', required: ['name', 'cost_price', 'sale_price'],
              properties: {
                name: { type: 'string', maxLength: 150 },
                description: { type: 'string' },
                category_id: { type: 'integer' }, supplier_id: { type: 'integer' },
                cost_price: { type: 'number', minimum: 0 }, sale_price: { type: 'number', exclusiveMinimum: 0 },
                image: { type: 'string', format: 'binary' }
              }
            }
          }
        }
      },
      responses: {
        201: { description: 'Created', content: { 'application/json': { schema: { type: 'object', properties: { id: { type: 'integer' }, image_url: { type: 'string' } } } } } },
        400: { description: 'Validation failure', content: { 'application/json': { schema: errorShape() } } },
        401: { description: 'Not authenticated', content: { 'application/json': { schema: errorShape() } } },
        403: { description: 'Not supplier/admin', content: { 'application/json': { schema: errorShape() } } },
        413: { description: 'Image too large', content: { 'application/json': { schema: errorShape() } } }
      }
    }
  },
  '/api/products/categories': {
    get: {
      tags: ['Products'], summary: 'List product categories', security: publicOp,
      responses: { 200: { description: 'Category rows' }, 500: { description: 'Failed', content: { 'application/json': { schema: errorShape() } } } }
    }
  },
  '/api/products/{id}': {
    get: {
      tags: ['Products'], summary: 'Product detail + rating + reviews', security: publicOp,
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer', minimum: 1 } }],
      responses: {
        200: { description: 'Product with rating/review_count/reviews' },
        404: { description: 'Not found', content: { 'application/json': { schema: errorShape() } } }
      }
    },
    put: {
      tags: ['Products'], summary: 'Update product (supplier/admin)',
      description: 'Multipart/form-data with optional `image` file.',
      security: bearer,
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer', minimum: 1 } }],
      requestBody: {
        required: true,
        content: { 'multipart/form-data': { schema: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' }, category_id: { type: 'integer' }, cost_price: { type: 'number' }, sale_price: { type: 'number' }, image: { type: 'string', format: 'binary' } } } } }
      },
      responses: {
        200: { description: 'Updated', content: { 'application/json': { schema: errorShape() } } },
        400: { description: 'Validation failure', content: { 'application/json': { schema: errorShape() } } },
        401: { description: 'Not authenticated', content: { 'application/json': { schema: errorShape() } } },
        403: { description: 'Not supplier/admin', content: { 'application/json': { schema: errorShape() } } }
      }
    },
    delete: {
      tags: ['Products'], summary: 'Delete product (supplier/admin)', security: bearer,
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer', minimum: 1 } }],
      responses: {
        200: { description: 'Deleted', content: { 'application/json': { schema: errorShape() } } },
        401: { description: 'Not authenticated', content: { 'application/json': { schema: errorShape() } } },
        403: { description: 'Not supplier/admin', content: { 'application/json': { schema: errorShape() } } }
      }
    }
  },
  '/api/products/{id}/reviews': {
    get: {
      tags: ['Reviews'], summary: 'Public reviews for a product', security: publicOp,
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer', minimum: 1 } }],
      responses: { 200: { description: 'Review rows (id, rating, comment, created_at, customer_name)' } }
    },
    post: {
      tags: ['Reviews'], summary: 'Customer submits a review (must have purchased the product)',
      security: bearer,
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer', minimum: 1 } }],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { type: 'object', required: ['rating'], properties: { rating: { type: 'integer', minimum: 1, maximum: 5 }, comment: { type: 'string' } } } } }
      },
      responses: {
        201: { description: 'Created', content: { 'application/json': { schema: { type: 'object', properties: { id: { type: 'integer' } } } } } },
        400: { description: 'Validation failure', content: { 'application/json': { schema: errorShape() } } },
        403: { description: 'Not a purchaser', content: { 'application/json': { schema: errorShape() } } },
        409: { description: 'Already reviewed for this purchase', content: { 'application/json': { schema: errorShape() } } }
      }
    }
  },

  '/api/inventory/retailer/{retailerId}': {
    get: {
      tags: ['Inventory'], summary: "Retailer's inventory with product info", security: bearer,
      parameters: [{ name: 'retailerId', in: 'path', required: true, schema: { type: 'integer', minimum: 1 } }],
      responses: { 200: { description: 'Inventory rows' }, 401: { description: 'Unauthenticated' }, 403: { description: 'Not retailer/admin' } }
    }
  },
  '/api/inventory/retailer/{retailerId}/low-stock': {
    get: {
      tags: ['Inventory'], summary: 'Items at/below their low-stock threshold', security: bearer,
      parameters: [{ name: 'retailerId', in: 'path', required: true, schema: { type: 'integer', minimum: 1 } }],
      responses: { 200: { description: 'Low-stock rows' } }
    }
  },
  '/api/inventory': {
    post: {
      tags: ['Inventory'], summary: 'Create an inventory record (retailer/admin)', security: bearer,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { type: 'object', required: ['product_id', 'retailer_id', 'quantity'], properties: {
              product_id: { type: 'integer', minimum: 1 }, retailer_id: { type: 'integer', minimum: 1 },
              quantity: { type: 'integer', minimum: 0 }, low_stock_threshold: { type: 'integer', minimum: 0 }
            } }
          }
        }
      },
      responses: { 201: { description: 'Created', content: { 'application/json': { schema: { type: 'object', properties: { id: { type: 'integer' } } } } } }, 400: { description: 'Validation failure' } }
    }
  },
  '/api/inventory/{id}': {
    put: {
      tags: ['Inventory'], summary: 'Update quantity/threshold (retailer/admin)',
      description: 'Dropping quantity at/below the threshold auto-creates a stock alert, pushes it live, and emails the retailer.',
      security: bearer,
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer', minimum: 1 } }],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { type: 'object', required: ['quantity', 'low_stock_threshold'], properties: { quantity: { type: 'integer', minimum: 0 }, low_stock_threshold: { type: 'integer', minimum: 0 } } } } }
      },
      responses: { 200: { description: 'Updated', content: { 'application/json': { schema: errorShape() } } }, 400: { description: 'Validation failure' } }
    }
  },

  '/api/orders': {
    post: {
      tags: ['Orders'], summary: 'Place an order (customer)',
      description: 'Transactional: guarded inventory decrement (oversell → 409 + rollback), optional coupon (locked FOR UPDATE), profit/sales recording. Emails an order confirmation to the customer; pushes real-time new-order event.',
      security: bearer,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object', required: ['retailer_id', 'items'],
              properties: {
                retailer_id: { type: 'integer', minimum: 1 },
                items: { type: 'array', minItems: 1, items: { type: 'object', required: ['product_id', 'quantity'], properties: { product_id: { type: 'integer', minimum: 1 }, quantity: { type: 'integer', minimum: 1 } } } },
                coupon_code: { type: 'string' }
              }
            }
          }
        }
      },
      responses: {
        201: { description: 'Created', content: { 'application/json': { schema: { type: 'object', properties: { orderId: { type: 'integer' }, total: { type: 'number' }, discount: { type: 'number' } } } } } },
        400: { description: 'Validation / dead coupon', content: { 'application/json': { schema: errorShape() } } },
        401: { description: 'Unauthenticated' }, 403: { description: 'Not a customer' },
        409: { description: 'Insufficient stock (rolled back)', content: { 'application/json': { schema: errorShape() } } }
      }
    }
  },
  '/api/orders/customer/{customerId}': {
    get: {
      tags: ['Orders'], summary: "Customer's order history (with line items)", security: bearer,
      parameters: [{ name: 'customerId', in: 'path', required: true, schema: { type: 'integer', minimum: 1 } }],
      responses: { 200: { description: 'Order rows with items' }, 401: { description: 'Unauthenticated' } }
    }
  },
  '/api/orders/retailer/{retailerId}': {
    get: {
      tags: ['Orders'], summary: "Retailer's orders with customer info (retailer/admin)", security: bearer,
      parameters: [{ name: 'retailerId', in: 'path', required: true, schema: { type: 'integer', minimum: 1 } }],
      responses: { 200: { description: 'Order rows with items' }, 403: { description: 'Not retailer/admin' } }
    }
  },
  '/api/orders/{id}/status': {
    put: {
      tags: ['Orders'], summary: 'Advance order status (retailer/admin)',
      description: 'Enforces pending → confirmed → shipped → delivered (cancellable). Emails the customer + pushes live status-change; logged to audit_log.',
      security: bearer,
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer', minimum: 1 } }],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { type: 'object', required: ['status'], properties: { status: { type: 'string', enum: ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'] } } } } }
      },
      responses: {
        200: { description: 'Updated', content: { 'application/json': { schema: { type: 'object', properties: { message: { type: 'string' }, status: { type: 'string' } } } } } },
        400: { description: 'Illegal transition', content: { 'application/json': { schema: errorShape() } } },
        404: { description: 'Order not found', content: { 'application/json': { schema: errorShape() } } }
      }
    }
  },

  '/api/dashboard/retailer/{retailerId}/summary': {
    get: {
      tags: ['Dashboards'], summary: 'Retailer dashboard aggregates (cached, Redis fail-open)', security: bearer,
      parameters: [{ name: 'retailerId', in: 'path', required: true, schema: { type: 'integer', minimum: 1 } }],
      responses: { 200: { description: 'totals/topProducts/categoryBreakdown/dailySales/lowStock (X-Cache header)' }, 403: { description: 'Not retailer/admin' } }
    }
  },
  '/api/dashboard/admin/summary': {
    get: {
      tags: ['Dashboards'], summary: 'Platform-wide admin aggregates (cached, fail-open)', security: bearer,
      responses: { 200: { description: 'totals/byRetailer/userCounts/topProductsPlatform' }, 403: { description: 'Not admin' } }
    }
  },
  '/api/dashboard/supplier/{supplierId}/summary': {
    get: {
      tags: ['Dashboards'], summary: "Supplier's product performance + stock across retailers", security: bearer,
      parameters: [{ name: 'supplierId', in: 'path', required: true, schema: { type: 'integer', minimum: 1 } }],
      responses: { 200: { description: 'productPerformance/stockAcrossRetailers' }, 403: { description: 'Not supplier/admin' } }
    }
  },

  '/api/ml/recommend/{customerId}': {
    get: {
      tags: ['ML'], summary: 'Product recommendations for a customer',
      description: 'Proxies the Python recommender (collab + cold-start fallback). Audit rows only on real recompute (X-ML-Computed: true).',
      security: bearer,
      parameters: [{ name: 'customerId', in: 'path', required: true, schema: { type: 'integer', minimum: 1 } }],
      responses: { 200: { description: 'Recommendation rows (product_id, score)' }, 502: { description: 'ML service down', content: { 'application/json': { schema: errorShape() } } } }
    }
  },
  '/api/ml/predict-demand/{retailerId}': {
    get: {
      tags: ['ML'], summary: 'Demand forecast for a retailer’s products',
      security: bearer,
      parameters: [{ name: 'retailerId', in: 'path', required: true, schema: { type: 'integer', minimum: 1 } }],
      responses: { 200: { description: 'Predictions (product_id, product_name, predicted_demand)' }, 502: { description: 'ML service down', content: { 'application/json': { schema: errorShape() } } } }
    }
  },
  '/api/ml/model-health': {
    get: {
      tags: ['ML'], summary: 'Model registry + metrics (MAE, precision@k)', security: bearer,
      responses: { 200: { description: 'Model health payload' }, 403: { description: 'Not admin' }, 502: { description: 'ML service down' } }
    }
  },
  '/api/ml/retrain': {
    post: {
      tags: ['ML'], summary: 'Force model (re)build (admin)', description: 'target: recommend | demand | all; retailer_id scopes demand. Logged to audit_log.',
      security: bearer,
      requestBody: {
        content: { 'application/json': { schema: { type: 'object', properties: { target: { type: 'string', enum: ['recommend', 'demand', 'all'] }, retailer_id: { type: 'integer', minimum: 1 } } } } }
      },
      responses: { 200: { description: 'Retrain result' }, 403: { description: 'Not admin' }, 502: { description: 'ML service down' } }
    }
  },

  '/api/wishlist/mine': {
    get: {
      tags: ['Wishlist'], summary: 'List the customer’s wishlist (with product details)', security: bearer,
      responses: { 200: { description: 'Wishlist rows' }, 403: { description: 'Not a customer' } }
    }
  },
  '/api/wishlist': {
    post: {
      tags: ['Wishlist'], summary: 'Add a product to the wishlist (idempotent)', security: bearer,
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { type: 'object', required: ['product_id'], properties: { product_id: { type: 'integer', minimum: 1 } } } } }
      },
      responses: { 201: { description: 'Added', content: { 'application/json': { schema: { type: 'object', properties: { id: { type: 'integer' } } } } } }, 200: { description: 'Already present' }, 403: { description: 'Not a customer' } }
    }
  },
  '/api/wishlist/{productId}': {
    delete: {
      tags: ['Wishlist'], summary: 'Remove a product from the wishlist', security: bearer,
      parameters: [{ name: 'productId', in: 'path', required: true, schema: { type: 'integer', minimum: 1 } }],
      responses: { 200: { description: 'Removed', content: { 'application/json': { schema: errorShape() } } }, 403: { description: 'Not a customer' } }
    }
  },

  '/api/retailers': {
    get: {
      tags: ['Reference'], summary: 'Public list of stores to order from', security: publicOp,
      responses: { 200: { description: 'Retailer rows (id, store_name, location)' } }
    }
  },

  '/api/coupons': {
    post: {
      tags: ['Coupons'], summary: 'Create a coupon (admin)', description: 'Logged to audit_log.', security: bearer,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object', required: ['code', 'discount_type', 'discount_value'],
              properties: {
                code: { type: 'string', maxLength: 50 },
                description: { type: 'string' },
                discount_type: { type: 'string', enum: ['percent', 'flat'] },
                discount_value: { type: 'number', exclusiveMinimum: 0 },
                min_order_value: { type: 'number', minimum: 0 },
                max_discount: { type: 'number', minimum: 0 },
                usage_limit: { type: 'integer', minimum: 1 },
                active: { type: 'boolean' },
                valid_from: { type: 'string', format: 'date-time' },
                valid_to: { type: 'string', format: 'date-time' },
                retailer_id: { type: 'integer', minimum: 1 }
              }
            }
          }
        }
      },
      responses: {
        201: { description: 'Created', content: { 'application/json': { schema: { type: 'object', properties: { id: { type: 'integer' }, code: { type: 'string' } } } } } },
        409: { description: 'Coupon code already exists', content: { 'application/json': { schema: errorShape() } } },
        403: { description: 'Not admin' }
      }
    },
    get: {
      tags: ['Coupons'], summary: 'List all coupons (admin)', security: bearer,
      responses: { 200: { description: 'Coupon rows' }, 403: { description: 'Not admin' } }
    }
  },
  '/api/coupons/{id}': {
    get: {
      tags: ['Coupons'], summary: 'Coupon detail (admin)', security: bearer,
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer', minimum: 1 } }],
      responses: { 200: { description: 'Coupon row' }, 403: { description: 'Not admin' }, 404: { description: 'Not found' } }
    },
    put: {
      tags: ['Coupons'], summary: 'Update coupon fields (admin)', security: bearer,
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer', minimum: 1 } }],
      requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { code: { type: 'string' }, active: { type: 'boolean' }, discount_value: { type: 'number' }, usage_limit: { type: 'integer' } } } } } },
      responses: { 200: { description: 'Updated', content: { 'application/json': { schema: errorShape() } } }, 409: { description: 'Duplicate code' }, 403: { description: 'Not admin' } }
    },
    delete: {
      tags: ['Coupons'], summary: 'Delete a coupon (admin)', description: 'Logged to audit_log.', security: bearer,
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer', minimum: 1 } }],
      responses: { 200: { description: 'Deleted', content: { 'application/json': { schema: errorShape() } } }, 403: { description: 'Not admin' } }
    }
  },
  '/api/coupons/validate': {
    post: {
      tags: ['Coupons'], summary: 'Validate a coupon against a prospective order (customer)',
      description: 'Read-only check; returns the discount that checkout would apply.',
      security: bearer,
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { type: 'object', required: ['code', 'order_value', 'retailer_id'], properties: { code: { type: 'string' }, order_value: { type: 'number', exclusiveMinimum: 0 }, retailer_id: { type: 'integer', minimum: 1 } } } } }
      },
      responses: {
        200: { description: 'Valid with discount', content: { 'application/json': { schema: { type: 'object', properties: { valid: { type: 'boolean' }, coupon_id: { type: 'integer' }, code: { type: 'string' }, discount: { type: 'number' }, discount_type: { type: 'string' }, discount_value: { type: 'number' } } } } } },
        400: { description: 'Invalid/inactive/expired etc.', content: { 'application/json': { schema: { type: 'object', properties: { valid: { type: 'boolean' }, reason: { type: 'string' }, error: { type: 'string' } } } } } },
        403: { description: 'Not a customer' }
      }
    }
  },

  '/api/reports/sales/csv': {
    get: {
      tags: ['Reports'], summary: 'Sales report as CSV (retailer auto-scoped / admin optional ?retailer_id)', security: bearer,
      parameters: [{ name: 'retailer_id', in: 'query', schema: { type: 'integer', minimum: 1 }, description: 'Admin-only filter' }],
      responses: { 200: { description: 'CSV download' }, 403: { description: 'Not retailer/admin' } }
    }
  },
  '/api/reports/inventory/csv': {
    get: {
      tags: ['Reports'], summary: 'Inventory report as CSV', security: bearer,
      parameters: [{ name: 'retailer_id', in: 'query', schema: { type: 'integer', minimum: 1 } }],
      responses: { 200: { description: 'CSV download' }, 403: { description: 'Not retailer/admin' } }
    }
  },
  '/api/reports/sales/pdf': {
    get: {
      tags: ['Reports'], summary: 'Sales report as PDF', security: bearer,
      parameters: [{ name: 'retailer_id', in: 'query', schema: { type: 'integer', minimum: 1 } }],
      responses: { 200: { description: 'PDF download' }, 403: { description: 'Not retailer/admin' } }
    }
  },
  '/api/reports/inventory/pdf': {
    get: {
      tags: ['Reports'], summary: 'Inventory report as PDF', security: bearer,
      parameters: [{ name: 'retailer_id', in: 'query', schema: { type: 'integer', minimum: 1 } }],
      responses: { 200: { description: 'PDF download' }, 403: { description: 'Not retailer/admin' } }
    }
  },

  '/api/docs': {
    get: {
      tags: ['System'], summary: 'Swagger UI (human-readable API browser)', security: publicOp,
      responses: { 200: { description: 'HTML UI — redirects to /api/docs/' } }
    }
  },

  '/api/audit': {
    get: {
      tags: ['Admin'], summary: 'Paginated admin audit log',
      description: 'Tracks privileged actions: coupon.create/delete, product.create/delete, order.status, model.retrain.',
      security: bearer,
      parameters: [
        { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1 }, description: '1-based page (default 1)' },
        { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 }, description: 'Rows per page (default 20)' },
        { name: 'action', in: 'query', schema: { type: 'string' }, description: 'Filter by exact action (e.g. coupon.create)' },
        { name: 'entity_type', in: 'query', schema: { type: 'string' }, description: 'Filter by entity type (coupon/product/order/model)' },
        { name: 'entity_id', in: 'query', schema: { type: 'integer' }, description: 'Filter by entity id' }
      ],
      responses: {
        200: {
          description: 'Paginated audit rows',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'integer' },
                        actor_id: { type: 'integer' },
                        actor_role: { type: 'string' },
                        action: { type: 'string' },
                        entity_type: { type: 'string' },
                        entity_id: { type: 'integer' },
                        details: { type: 'object' },
                        created_at: { type: 'string', format: 'date-time' }
                      }
                    }
                  },
                  page: { type: 'integer' },
                  limit: { type: 'integer' },
                  total: { type: 'integer' },
                  totalPages: { type: 'integer' }
                }
              }
            }
          }
        },
        403: { description: 'Not admin' }
      }
    }
  }
};

const definition = {
  openapi: '3.0.0',
  info: {
    title: 'ShopWise 360 API',
    version: '1.0.0',
    description:
      'Retail demand & customer analytics platform — Node/Express API.\n\n' +
      'Auth: access tokens (`type: access`) are issued by `/api/auth/login` / `/api/auth/register` and passed as `Authorization: Bearer <token>`. ' +
      'Refresh tokens are opaque, rotating, and must NOT be used as bearer credentials. ' +
      'Validation failures return `{ error, errors: [{ field, msg }] }` with HTTP 400. ' +
      'All authenticated routes 401 without a valid token and 403 when the role is insufficient.\n\n' +
      'Served by swagger-jsdoc + swagger-ui-express — this spec mirrors the routes actually registered in ./server.js ' +
      '(a boot-time drift check warns if a real route lacks a spec entry).'
  },
  servers: [{ url: '/' }]
};

/**
 * Build the OpenAPI doc. swagger-jsdoc merges the definition (params/schemas)
 * into a valid 3.0.0 document; we keep it authoritative here rather than
 * scattering JSDoc comments, so the spec stays in lockstep with the router.
 */
const spec = swaggerJsdoc({ swaggerDefinition: definition, apis: [] });
spec.components = { securitySchemes: security };
spec.paths = paths;

/**
 * Boot-time drift check: given the express app’s routers (prefix → router),
 * report every real route that has no spec entry. Best-effort — logs warnings,
 * never crashes.
 */
function checkCoverage(mounts, logger = console) {
  const real = [];
  for (const { prefix, router } of mounts) {
    for (const layer of router.stack || []) {
      if (!layer.route) continue;
      const methods = Object.keys(layer.route.methods).filter((m) => m !== 'head' && m !== 'options');
      const path = (prefix + layer.route.path).replace(/:(\w+)/g, '{$1}').replace(/\/+/g, '/');
      for (const m of methods) real.push({ method: m.toUpperCase(), path: path === '/' ? '/' : path.replace(/\/$/, '') });
    }
  }
  real.push({ method: 'GET', path: '/api/health' });

  const specKey = (path) =>
    spec.paths[path]
      ? path
      : Object.keys(spec.paths).find((s) => s.includes('{') && matchesTemplate(s, path));

  const missing = real.filter(({ method, path }) => {
    const key = specKey(path);
    return !key || !spec.paths[key][method.toLowerCase()];
  });

  if (missing.length) {
    logger.warn(`[swagger] coverage gap — ${missing.length} real route(s) not in the API spec: ${missing.map((r) => `${r.method} ${r.path}`).join(', ')}`);
  } else {
    logger.log(`[swagger] coverage OK — all ${real.length} real routes documented`);
  }
  return { real, missing };
}

function matchesTemplate(specPath, realPath) {
  const parts = specPath.split('/');
  const actual = realPath.split('/');
  if (parts.length !== actual.length) return false;
  return parts.every((p, i) => p.startsWith('{') || p === actual[i]);
}

module.exports = { spec, checkCoverage, definition };