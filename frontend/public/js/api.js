/* ============================================
   PAULINE FASHION STORE — API LAYER
   Backend: Node.js + MySQL
   ============================================ */

/* ---- Switch this to your live domain when deploying ---- */
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:5000/api'
  : 'https://your-backend-domain.com/api';   /* ← change this before going live */

/* ============================================
   AUTH HELPERS
   ============================================ */
const Auth = {
  setToken:  (t) => localStorage.setItem('ps_token', t),
  getToken:  ()  => localStorage.getItem('ps_token'),
  setUser:   (u) => localStorage.setItem('ps_user', JSON.stringify(u)),
  getUser:   ()  => {
    try { return JSON.parse(localStorage.getItem('ps_user')); }
    catch { return null; }
  },
  isLoggedIn: () => !!localStorage.getItem('ps_token'),
  isAdmin:    () => { const u = Auth.getUser(); return u?.role === 'admin'; },
  logout: () => {
    localStorage.removeItem('ps_token');
    localStorage.removeItem('ps_user');
    localStorage.removeItem('ps_cart');
    /* Only redirect if not already on login page to avoid redirect loops */
    if (!window.location.pathname.endsWith('login.html')) {
      window.location.href = 'login.html';
    }
  },
};

/* ============================================
   API REQUEST HELPER
   ============================================ */
async function apiRequest(endpoint, method = 'GET', body = null, auth = false) {
  const headers = { 'Content-Type': 'application/json' };

  if (auth) {
    const token = Auth.getToken();
    if (!token) {
      /* No token — redirect to login without calling logout (avoids loop) */
      if (!window.location.pathname.endsWith('login.html')) {
        window.location.href = 'login.html';
      }
      return;
    }
    headers['Authorization'] = `Bearer ${token}`;
  }

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  try {
    const res  = await fetch(`${API_BASE}${endpoint}`, opts);
    const data = await res.json();

    /* 401 — token expired or invalid; clear session and redirect */
    if (res.status === 401) {
      Auth.logout();
      return;
    }

    if (!res.ok) {
      throw new Error(data.message || `Request failed (${res.status})`);
    }

    return data;

  } catch (err) {
    /* Re-throw so callers can catch and show user-friendly messages */
    throw err;
  }
}

/* ============================================
   PRODUCT API
   ============================================ */
const ProductAPI = {
  getAll: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiRequest(`/products${q ? '?' + q : ''}`);
  },
  getById: (id) => apiRequest(`/products/${id}`),

  /* FormData requests — no Content-Type header so browser sets multipart boundary */
  create: async (fd) => {
    const token = Auth.getToken();
    if (!token) { window.location.href = 'login.html'; return; }
    const res  = await fetch(`${API_BASE}/products`, {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body:    fd,
    });
    const data = await res.json();
    if (res.status === 401) { Auth.logout(); return; }
    if (!res.ok) throw new Error(data.message || 'Failed to create product');
    return data;
  },

  update: async (id, fd) => {
    const token = Auth.getToken();
    if (!token) { window.location.href = 'login.html'; return; }
    const res  = await fetch(`${API_BASE}/products/${id}`, {
      method:  'PUT',
      headers: { 'Authorization': `Bearer ${token}` },
      body:    fd,
    });
    const data = await res.json();
    if (res.status === 401) { Auth.logout(); return; }
    if (!res.ok) throw new Error(data.message || 'Failed to update product');
    return data;
  },

  delete: (id) => apiRequest(`/products/${id}`, 'DELETE', null, true),
};

/* ============================================
   CART API
   ============================================ */
const CartAPI = {
  get:    ()                               => apiRequest('/cart', 'GET', null, true),
  add:    (productId, qty=1, size='', color='') =>
    apiRequest('/cart/add', 'POST', { productId, quantity: qty, size, color }, true),
  update: (productId, qty, size='', color='')   =>
    apiRequest('/cart/update', 'PUT', { productId, quantity: qty, size, color }, true),
  remove: (productId, size='', color='')        => {
    const params = new URLSearchParams({ size, color }).toString();
    return apiRequest(`/cart/remove/${productId}?${params}`, 'DELETE', null, true);
  },
  clear:  ()  => apiRequest('/cart/clear', 'DELETE', null, true),
};

/* ============================================
   ORDER API
   ============================================ */
const OrderAPI = {
  place: (data) =>
    apiRequest('/orders', 'POST', data, true),

  getMyOrders: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiRequest(`/orders/myorders${q ? '?' + q : ''}`, 'GET', null, true);
  },

  getById: (id) =>
    apiRequest(`/orders/${id}`, 'GET', null, true),

  getAll: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiRequest(`/orders${q ? '?' + q : ''}`, 'GET', null, true);
  },

  updateStatus: (id, data) =>
    apiRequest(`/orders/${id}`, 'PUT', data, true),
};

/* ============================================
   AUTH API
   ============================================ */
const AuthAPI = {
  register:       (d) => apiRequest('/auth/register',        'POST', d),
  login:          (d) => apiRequest('/auth/login',           'POST', d),
  forgotPassword: (d) => apiRequest('/auth/forgot-password', 'POST', d),
  resetPassword:  (d) => apiRequest('/auth/reset-password',  'POST', d),
  profile:        ()  => apiRequest('/auth/profile',         'GET',  null, true),
  update:         (d) => apiRequest('/auth/profile',         'PUT',  d,    true),
};

/* ============================================
   LOCAL CART — for guests
   ============================================ */
const LocalCart = {
  KEY: 'ps_cart',

  get: () => {
    try { return JSON.parse(localStorage.getItem('ps_cart')) || []; }
    catch { return []; }
  },

  save: (c) => localStorage.setItem('ps_cart', JSON.stringify(c)),

  add: (product, qty = 1, size = '', color = '') => {
    const cart = LocalCart.get();
    const key  = `${product.id}-${size}-${color}`;
    const idx  = cart.findIndex(i => i.key === key);
    if (idx > -1) {
      cart[idx].quantity = Math.min(cart[idx].quantity + qty, 10);
    } else {
      cart.push({
        key,
        product_id:  product.id,
        name:        product.name,
        price:       product.price,
        price_at_add:product.price,
        image:       product.image || '',
        category:    product.category || '',
        size,
        color,
        quantity:    qty,
      });
    }
    LocalCart.save(cart);
    return LocalCart.get();
  },

  remove: (key) => {
    const c = LocalCart.get().filter(i => i.key !== key);
    LocalCart.save(c);
    return c;
  },

  update: (key, qty) => {
    const c = LocalCart.get();
    const i = c.findIndex(x => x.key === key);
    if (i > -1) {
      if (qty <= 0) c.splice(i, 1);
      else c[i].quantity = Math.min(qty, 10);
    }
    LocalCart.save(c);
    return c;
  },

  clear:    () => { localStorage.removeItem('ps_cart'); return []; },
  getCount: () => LocalCart.get().reduce((s, i) => s + i.quantity, 0),
  getTotal: () => LocalCart.get().reduce(
    (s, i) => s + (parseFloat(i.price_at_add || i.price) * i.quantity), 0
  ),
};

/* ============================================
   HELPERS
   ============================================ */

/** Returns the full URL for a product image filename */
function getImageUrl(filename) {
  if (!filename || filename === 'default-product.png') return null;
  if (filename.startsWith('http')) return filename;
  return `${API_BASE.replace('/api', '')}/uploads/${filename}`;
}

/** Format a number as KSh currency */
function formatKES(amount) {
  const num = parseFloat(amount) || 0;
  return `KSh ${num.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

/** Format an ISO date string for display */
function formatDate(str) {
  if (!str) return '—';
  return new Date(str).toLocaleDateString('en-KE', {
    year:  'numeric',
    month: 'short',
    day:   'numeric',
  });
}

/** Safely escape a string for use inside HTML attribute values */
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/* ============================================
   TOAST NOTIFICATIONS
   ============================================ */
function showToast(message, type = 'info', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id        = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const icons = { success: '✓', error: '✕', warning: '⚠', info: 'i' };
  const toast  = document.createElement('div');
  toast.className = `toast ${type}`;

  /* Use textContent for icon and message to prevent XSS */
  const iconEl = document.createElement('span');
  iconEl.style.fontWeight = '800';
  iconEl.textContent      = icons[type] || 'i';

  const msgEl = document.createElement('span');
  msgEl.textContent = message;

  toast.appendChild(iconEl);
  toast.appendChild(msgEl);
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/* ============================================
   CART BADGE — update count in navbar
   ============================================ */
async function updateCartBadge() {
  let count = 0;
  if (Auth.isLoggedIn()) {
    try {
      const d = await CartAPI.get();
      count   = d?.cart?.totalItems || 0;
    } catch {
      count = LocalCart.getCount();
    }
  } else {
    count = LocalCart.getCount();
  }

  document.querySelectorAll('.cart-badge').forEach(b => {
    b.textContent = count;
    b.classList.toggle('hidden', count === 0);
  });
}

/* ============================================
   CATEGORY EMOJI HELPER
   ============================================ */
function getCategoryEmoji(cat) {
  const map = {
    shoes:       '👟',
    hoodie:      '🧥',
    tshirt:      '👕',
    jeans:       '👖',
    dress:       '👗',
    accessories: '👜',
    men:         '👔',
    women:       '👗',
  };
  return map[cat] || '🛍️';
}

/* ============================================
   RENDER PRODUCT CARD
   FIX: data-* attributes use escHtml() to
        prevent XSS via product names with
        quotes or special characters.
   ============================================ */
function renderProductCard(p) {
  const img         = getImageUrl(p.image);
  const hasDiscount = p.original_price && parseFloat(p.original_price) > parseFloat(p.price);
  const discPct     = hasDiscount ? Math.round((1 - p.price / p.original_price) * 100) : 0;
  const isOutOfStock = parseInt(p.stock) === 0;

  /* Random review count — seeded by product ID for consistency within session */
  const reviewCount = 10 + (p.id % 90);

  const imgHtml = img
    ? `<img src="${escHtml(img)}" alt="${escHtml(p.name)}" loading="lazy"
           onerror="this.parentNode.innerHTML='<div class=\\'product-card-placeholder\\'>${getCategoryEmoji(p.category)}</div>'">`
    : `<div class="product-card-placeholder">${getCategoryEmoji(p.category)}</div>`;

  const badges = [];
  if (isOutOfStock)        badges.push(`<span class="product-badge badge-sold">Sold Out</span>`);
  else if (hasDiscount)    badges.push(`<span class="product-badge badge-sale">-${discPct}%</span>`);
  else if (p.is_featured)  badges.push(`<span class="product-badge badge-new">New</span>`);

  return `
<div class="product-card"
    data-id="${escHtml(String(p.id))}"
    data-name="${escHtml(p.name)}"
    data-price="${escHtml(String(p.price))}"
    data-image="${escHtml(p.image || '')}"
    data-category="${escHtml(p.category)}"
    data-stock="${escHtml(String(p.stock))}">

    <div class="product-card-img">

        ${imgHtml}

        ${badges.length
            ? `<div class="product-badge-wrap">${badges.join("")}</div>`
            : ""}

    </div>

    <div class="product-info">

        <div class="product-rating">

            <span class="stars">★★★★★</span>

            <span class="count">
                (${reviewCount} Reviews)
            </span>

        </div>

        <div class="product-name">

            <a href="product.html?id=${escHtml(String(p.id))}">
                ${escHtml(p.name)}
            </a>

        </div>

        <div class="product-price-row">

            <span class="product-price">
                ${formatKES(p.price)}
            </span>

            ${hasDiscount
                ? `
                <span class="product-price-old">
                    ${formatKES(p.original_price)}
                </span>`
                : ""}

        </div>

        <div class="product-actions">

            <a href="product.html?id=${escHtml(String(p.id))}"
               class="details-btn">
                View Details

            </a>

            ${
                !isOutOfStock
                ? `
                <button class="quick-add-btn">
                    
                    Add to Cart
                </button>
                `
                : `
                <button class="quick-add-btn out-of-stock" disabled>
                    Out of Stock
                </button>
                `
            }

        </div>

    </div>

</div>
`;
}
