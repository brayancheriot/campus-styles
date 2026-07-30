/* ============================================
   PAULINE FASHION STORE â€” MAIN JS
   ============================================ */

/* ============================================
   NAVBAR
   ============================================ */
function initNavbar() {
  const navbar    = document.getElementById('navbar');
  const hamburger = document.getElementById('hamburger');
  const mobileNav = document.getElementById('mobile-nav');

  if (navbar) {
    window.addEventListener('scroll', () =>
      navbar.classList.toggle('scrolled', window.scrollY > 10)
    );
  }

  hamburger?.addEventListener('click', () => {
    hamburger.classList.toggle('active');
    mobileNav?.classList.toggle('open');
    document.body.style.overflow = mobileNav?.classList.contains('open') ? 'hidden' : '';
  });

  /* Close mobile nav on link click */
  mobileNav?.querySelectorAll('.mobile-nav-link').forEach(link => {
    link.addEventListener('click', () => {
      hamburger?.classList.remove('active');
      mobileNav.classList.remove('open');
      document.body.style.overflow = '';
    });
  });

  /* Highlight active link */
  const page = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link, .mobile-nav-link').forEach(link => {
    if (link.getAttribute('href') === page) link.classList.add('active');
  });

  updateNavUser();
}

function updateNavUser() {
  const user     = Auth.getUser();
  const loginLink = document.getElementById('nav-login-link');
  if (user && loginLink) {
    loginLink.textContent = escHtml(user.name.split(' ')[0]);
    loginLink.href = '#';
    loginLink.addEventListener('click', e => {
      e.preventDefault();
      const existing = document.getElementById('user-dropdown');
      if (existing) { existing.remove(); return; }
      showUserDropdown(loginLink, user);
    });
  }
}

function showUserDropdown(anchor, user) {
  const rect     = anchor.getBoundingClientRect();
  const dropdown = document.createElement('div');
  dropdown.id    = 'user-dropdown';
  dropdown.style.cssText = `
    position:fixed; top:${rect.bottom + 8}px; right:20px;
    background:white; border:1px solid var(--border); border-radius:var(--radius-md);
    padding:8px; min-width:180px; z-index:2000; box-shadow:var(--shadow-lg);
    animation:slideUp 0.2s ease;
  `;

  /* Build dropdown with DOM (not innerHTML) to avoid XSS via user.name/email */
  const header = document.createElement('div');
  header.style.cssText = 'padding:8px 12px 12px;border-bottom:1px solid var(--border);margin-bottom:4px;';
  const nameEl = document.createElement('div');
  nameEl.style.cssText = 'font-size:14px;font-weight:700;';
  nameEl.textContent   = user.name;
  const emailEl = document.createElement('div');
  emailEl.style.cssText = 'font-size:12px;color:var(--text-muted);';
  emailEl.textContent   = user.email;
  header.append(nameEl, emailEl);

  const linkStyle = 'display:flex;align-items:center;gap:8px;padding:9px 12px;font-size:13px;font-weight:600;border-radius:var(--radius-sm);text-decoration:none;color:var(--text);';

  const ordersLink = document.createElement('a');
  ordersLink.href        = 'orders.html';
  ordersLink.style.cssText = linkStyle;
  ordersLink.textContent = 'My Orders';
  ordersLink.onmouseover = () => ordersLink.style.background = 'var(--off-white)';
  ordersLink.onmouseout  = () => ordersLink.style.background = '';

  const signoutBtn = document.createElement('button');
  signoutBtn.style.cssText = 'width:100%;display:flex;align-items:center;gap:8px;padding:9px 12px;font-size:13px;font-weight:600;border-radius:var(--radius-sm);color:#e53935;background:none;border:none;cursor:pointer;margin-top:4px;';
  signoutBtn.textContent   = ' Sign Out';
  signoutBtn.onmouseover   = () => signoutBtn.style.background = 'rgba(229,57,53,0.06)';
  signoutBtn.onmouseout    = () => signoutBtn.style.background = '';
  signoutBtn.addEventListener('click', Auth.logout);

  dropdown.append(header, ordersLink);

  if (Auth.isAdmin()) {
    const adminLink = document.createElement('a');
    adminLink.href         = 'admin.html';
    adminLink.style.cssText = linkStyle;
    adminLink.textContent  = 'Admin Panel';
    adminLink.onmouseover  = () => adminLink.style.background = 'var(--off-white)';
    adminLink.onmouseout   = () => adminLink.style.background = '';
    dropdown.appendChild(adminLink);
  }

  dropdown.appendChild(signoutBtn);
  document.body.appendChild(dropdown);

  /* Close dropdown when clicking outside */
  setTimeout(() => {
    document.addEventListener('click', function close(e) {
      if (!dropdown.contains(e.target) && e.target !== anchor) {
        dropdown.remove();
        document.removeEventListener('click', close);
      }
    });
  }, 100);
}

/* ============================================
   SCROLL TO TOP
   ============================================ */
function initScrollTop() {
  const btn = document.getElementById('scroll-top');
  if (!btn) return;
  window.addEventListener('scroll', () =>
    btn.classList.toggle('visible', window.scrollY > 400)
  );
  btn.addEventListener('click', () =>
    window.scrollTo({ top: 0, behavior: 'smooth' })
  );
}

/* ============================================
   COUNTDOWN
   ============================================ */
function initCountdown() {
  const els = {
    days:  document.getElementById('cd-days'),
    hours: document.getElementById('cd-hours'),
    mins:  document.getElementById('cd-mins'),
    secs:  document.getElementById('cd-secs'),
  };
  if (!els.days) return;

  const end = new Date();
  end.setDate(end.getDate() + 3);

  const update = () => {
    const d = end - new Date();
    if (d <= 0) return;
    els.days.textContent  = String(Math.floor(d / 86400000)).padStart(2, '0');
    els.hours.textContent = String(Math.floor((d % 86400000) / 3600000)).padStart(2, '0');
    els.mins.textContent  = String(Math.floor((d % 3600000) / 60000)).padStart(2, '0');
    els.secs.textContent  = String(Math.floor((d % 60000) / 1000)).padStart(2, '0');
  };
  update();
  setInterval(update, 1000);
}

/* ============================================
   HOMEPAGE
   ============================================ */
async function initHomepage() {
  await loadFeaturedProducts();
  initFilterTabs();
  initSlider();
}

async function loadFeaturedProducts(filter = '') {
  const container = document.getElementById('arrivals-grid');
  if (!container) return;
  container.innerHTML = `<div style="grid-column:1/-1;"><div class="spinner"></div></div>`;
  try {
    /* FIX: sort param must be 'created_at', not '-created_at' */
    const params = { limit: 8, sort: 'created_at', order: 'DESC' };
    if (filter && filter !== 'all') params.category = filter;
    const data     = await ProductAPI.getAll(params);
    const products = data?.products || [];
    if (!products.length) {
      container.innerHTML = `<div style="grid-column:1/-1;" class="empty-state"><div class="empty-state-icon"></div><p>No products yet.</p></div>`;
      return;
    }
    container.innerHTML = products.map(renderProductCard).join('');
    initQuickAddButtons();
    initWishlistButtons();
  } catch {
    container.innerHTML = `<div style="grid-column:1/-1;" class="empty-state"><div class="empty-state-icon"></div><p>Could not load products. Is the backend running?</p></div>`;
  }
}

function initFilterTabs() {
  document.querySelectorAll('.filter-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadFeaturedProducts(btn.dataset.filter || '');
    });
  });
}

function initSlider() {
  const prev = document.getElementById('slider-prev');
  const next = document.getElementById('slider-next');
  if (!prev || !next) return;
  let page = 0;

  next.addEventListener('click', async () => {
    page++;
    const container = document.getElementById('arrivals-grid');
    container.innerHTML = `<div style="grid-column:1/-1;"><div class="spinner"></div></div>`;
    try {
      const data = await ProductAPI.getAll({ limit: 8, page: page + 1 });
      if (!data?.products?.length) { page--; container.innerHTML = ''; await loadFeaturedProducts(); return; }
      container.innerHTML = data.products.map(renderProductCard).join('');
      initQuickAddButtons();
    } catch { page--; }
  });

  prev.addEventListener('click', async () => {
    if (page <= 0) return;
    page--;
    const container = document.getElementById('arrivals-grid');
    container.innerHTML = `<div style="grid-column:1/-1;"><div class="spinner"></div></div>`;
    try {
      const data = await ProductAPI.getAll({ limit: 8, page: page + 1 });
      container.innerHTML = data?.products?.map(renderProductCard).join('') || '';
      initQuickAddButtons();
    } catch {}
  });
}

/* ============================================
   SHOP PAGE
   ============================================ */
const shopState = {
  page: 1,
  limit: 12,
};

async function initShopPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const initCat   = urlParams.get('category') || '';

  /* Set active filter from URL */
  if (initCat) {
    document.querySelectorAll('.sidebar-filter-radio').forEach(r => {
      if (r.value === initCat) r.checked = true;
    });
  }

  /* Category filter */
  document.querySelectorAll('.sidebar-filter-radio').forEach(r => {
    r.addEventListener('change', () => {
      shopState.page = 1;
      loadShopProducts();
    });
  });

  /* Search with debounce */
  let searchTimer;
  document.getElementById('shop-search')?.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      shopState.page = 1;
      loadShopProducts();
    }, 400);
  });

  /* Sort */
  document.getElementById('shop-sort-select')?.addEventListener('change', () => {
    shopState.page = 1;
    loadShopProducts();
  });

  /* Price filter */
  document.getElementById('apply-price-btn')?.addEventListener('click', () => {
    shopState.page = 1;
    loadShopProducts();
  });

  document.querySelectorAll('#shop-size-options .size-option').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#shop-size-options .size-option').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      shopState.page = 1;
      loadShopProducts();
    });
  });

  document.querySelectorAll('#shop-color-options .color-swatch').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#shop-color-options .color-swatch').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      shopState.page = 1;
      loadShopProducts();
    });
  });

  /* Clear all filters */
  document.getElementById('clear-filters-btn')?.addEventListener('click', () => {
    document.querySelectorAll('.sidebar-filter-radio').forEach(r => {
      if (r.value === '') r.checked = true;
    });
    const searchEl = document.getElementById('shop-search');
    if (searchEl) searchEl.value = '';
    const minEl = document.getElementById('price-min');
    const maxEl = document.getElementById('price-max');
    if (minEl) minEl.value = '';
    if (maxEl) maxEl.value = '';
    document.querySelectorAll('#shop-size-options .size-option').forEach((btn, i) => btn.classList.toggle('active', i === 0));
    document.querySelectorAll('#shop-color-options .color-swatch').forEach((btn, i) => btn.classList.toggle('active', i === 0));
    shopState.page = 1;
    loadShopProducts();
  });

  await loadShopProducts();
}

async function loadShopProducts() {
  const grid    = document.getElementById('shop-grid');
  const countEl = document.getElementById('shop-count');
  if (!grid) return;
  grid.innerHTML = `<div style="grid-column:1/-1;"><div class="spinner"></div></div>`;

  const category = document.querySelector('.sidebar-filter-radio:checked')?.value || '';
  const search   = document.getElementById('shop-search')?.value.trim() || '';
  const sortVal  = document.getElementById('shop-sort-select')?.value || '';
  const minPrice = document.getElementById('price-min')?.value  || '';
  const maxPrice = document.getElementById('price-max')?.value  || '';
  const size      = document.querySelector('#shop-size-options .size-option.active')?.dataset.size || '';
  const color     = document.querySelector('#shop-color-options .color-swatch.active')?.dataset.color || '';

  /* FIX: sort params match backend's accepted values */
  const sortMap = {
    'price-asc':  { sort: 'price',      order: 'ASC'  },
    'price-desc': { sort: 'price',      order: 'DESC' },
    'newest':     { sort: 'created_at', order: 'DESC' },
    'name-asc':   { sort: 'name',       order: 'ASC'  },
  };
  const sortParams = sortMap[sortVal] || {};

  try {
    const params = { limit: shopState.limit, page: shopState.page, ...sortParams };
    if (category) params.category = category;
    if (search)   params.search   = search;
    if (minPrice) params.minPrice = minPrice;
    if (maxPrice) params.maxPrice = maxPrice;

    const data     = await ProductAPI.getAll(params);
    let products = data?.products || [];

    products = products.filter(p => {
      const sizes = Array.isArray(p.sizes) ? p.sizes : String(p.sizes || '').split(',').map(s => s.trim());
      const colors = Array.isArray(p.colors) ? p.colors : String(p.colors || '').split(',').map(c => c.trim().toLowerCase());
      const matchSize = !size || sizes.includes(size);
      const matchColor = !color || colors.includes(color.toLowerCase());
      return matchSize && matchColor;
    });

    if (countEl) {
      countEl.innerHTML = `Showing <span>${products.length}</span> of ${data?.total || products.length} results`;
    }

    if (!products.length) {
      grid.innerHTML = `<div style="grid-column:1/-1;" class="empty-state"><div class="empty-state-icon"></div><h3>No products found</h3><p>Try a different filter or search term.</p></div>`;
      return;
    }
    grid.innerHTML = products.map(renderProductCard).join('');
    initQuickAddButtons();
    initWishlistButtons();
    renderShopPagination(data?.total || products.length);
  } catch {
    grid.innerHTML = `<div style="grid-column:1/-1;" class="empty-state"><div class="empty-state-icon"></div><p>Failed to load. Is the backend running?</p></div>`;
  }
}

function renderShopPagination(total) {
  const container = document.getElementById('shop-pagination');
  if (!container) return;

  const pages = Math.max(1, Math.ceil((parseInt(total, 10) || 0) / shopState.limit));
  const visiblePages = Array.from({ length: Math.min(pages, 5) }, (_, i) => i + 1);

  container.innerHTML = visiblePages.map(page => `
    <button class="page-btn ${page === shopState.page ? 'active' : ''}" type="button" data-page="${page}">${page}</button>
  `).join('');

  container.querySelectorAll('.page-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const nextPage = parseInt(btn.dataset.page, 10);
      if (!nextPage || nextPage === shopState.page) return;
      shopState.page = nextPage;
      loadShopProducts();
      document.getElementById('shop-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

/* ============================================
   PRODUCT DETAIL PAGE
   ============================================ */
async function initProductPage() {
  const content = document.getElementById('product-detail-content');
  if (!content) return;

  const id = new URLSearchParams(window.location.search).get('id');
  if (!id) { window.location.href = 'shop.html'; return; }

  content.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Loading product...</p></div>`;

  try {
    const data = await ProductAPI.getById(id);
    const p    = data.product;
    document.title = `${escHtml(p.name)}  Paulah Styles`;

    const img         = getImageUrl(p.image);
    const hasDiscount = p.original_price && parseFloat(p.original_price) > parseFloat(p.price);
    const discPct     = hasDiscount ? Math.round((1 - p.price / p.original_price) * 100) : 0;
    const sizes       = Array.isArray(p.sizes)  ? p.sizes  : (p.sizes  || '').split(',').map(s => s.trim()).filter(Boolean);
    const colors      = Array.isArray(p.colors) ? p.colors : (p.colors || '').split(',').map(c => c.trim()).filter(Boolean);
    const stockColor  = p.stock > 10 ? 'var(--green)' : p.stock > 0 ? '#f5a623' : 'var(--red)';
    const stockLabel  = p.stock > 10 ? 'In Stock' : p.stock > 0 ? `Only ${p.stock} left!` : 'Out of Stock';

    content.innerHTML = `
      <div class="product-detail-layout">
        <div class="product-images">
          <div class="product-thumbs" id="product-thumbs">
            ${[0,1,2,3].map(i => `
              <div class="product-thumb ${i===0?'active':''}" data-img="${escHtml(img||'')}">
                ${img
                  ? `<img src="${escHtml(img)}" alt="${escHtml(p.name)}" ${i===1?'style="filter:brightness(0.9)"':''} ${i===2?'style="filter:contrast(1.1)"':''} ${i===3?'style="filter:saturate(1.2)"':''}>`
                  : `<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:1.5rem;">${getCategoryEmoji(p.category)}</div>`}
              </div>`).join('')}
          </div>
          <div class="product-main-image" id="product-main-image">
            ${img
              ? `<img src="${escHtml(img)}" alt="${escHtml(p.name)}" id="main-img">`
              : `<div class="product-main-placeholder">${getCategoryEmoji(p.category)}</div>`}
            ${hasDiscount ? `<div style="position:absolute;top:12px;left:12px;background:var(--red);color:white;padding:4px 10px;font-size:11px;font-weight:800;border-radius:2px;letter-spacing:0.5px;">-${discPct}%</div>` : ''}
          </div>
        </div>

        <div class="product-detail-info">
          <div class="breadcrumb">
            <a href="index.html">Home</a><span>/</span>
            <a href="shop.html">Shop</a><span>/</span>
            <a href="shop.html?category=${escHtml(p.category)}">${escHtml(p.category)}</a><span>/</span>
            <span class="current">${escHtml(p.name)}</span>
          </div>

          <h1 class="product-detail-name">${escHtml(p.name)}</h1>

          <div class="product-detail-rating">
            <span class="stars">★★★★★</span>
            <span style="font-weight:700;">(${10 + (p.id % 60)} Reviews)</span>
          </div>

          <div class="product-detail-price">
            ${formatKES(p.price)}
            ${hasDiscount ? `<span class="old-price">${formatKES(p.original_price)}</span>` : ''}
          </div>

          <p style="font-size:13px;font-weight:700;margin-bottom:20px;">
            <span style="color:${stockColor};"> ${escHtml(stockLabel)}</span>
          </p>

          <p class="product-detail-desc">${escHtml(p.description)}</p>

          ${sizes.length ? `
            <div style="margin-bottom:20px;">
              <div class="option-label">SIZE <span id="selected-size-label">Select a size</span></div>
              <div class="detail-size-options" id="size-options-container">
                ${sizes.map((s, i) => `<button class="detail-size-btn ${i===0?'active':''}" data-size="${escHtml(s)}">${escHtml(s)}</button>`).join('')}
              </div>
            </div>` : ''}

          ${colors.length ? `
            <div style="margin-bottom:20px;">
              <div class="option-label">COLOR <span id="selected-color-label">${escHtml(colors[0]||'')}</span></div>
              <div class="detail-colors" id="color-options-container">
                ${colors.map((c, i) => {
                  const colorMap = { 'White':'#ffffff','Black':'#0a0a0a','Grey':'#9e9e9e','Gray':'#9e9e9e','Blue':'#1565c0','Navy':'#0d1b5e','Red':'#c62828','Green':'#2e7d32','Brown':'#5d4037','Khaki':'#c8b560','Olive':'#556b2f','Tan':'#d2b48c' };
                  const bg     = colorMap[c] || '#ccc';
                  const border = c === 'White' ? '1px solid #ccc' : 'none';
                  return `<button class="detail-color-btn ${i===0?'active':''}" data-color="${escHtml(c)}" style="background:${bg};border:${border};" title="${escHtml(c)}"></button>`;
                }).join('')}
              </div>
            </div>` : ''}

          <div class="qty-row">
            <div class="qty-control">
              <button class="qty-btn qty-minus">-</button>
              <input type="number" class="qty-input" id="qty-input" value="1" min="1" max="${parseInt(p.stock)||1}">
              <button class="qty-btn qty-plus">+</button>
            </div>
            ${p.stock > 0 && p.stock <= 5 ? `<span class="qty-stock-note">Only ${p.stock} items left!</span>` : ''}
          </div>

          ${p.stock > 0 ? `
            <div class="product-cta">
              <button class="btn btn-outline btn-lg" id="add-to-cart-btn"
                data-id="${escHtml(String(p.id))}"
                data-name="${escHtml(p.name)}"
                data-price="${escHtml(String(p.price))}"
                data-category="${escHtml(p.category)}">ADD TO CART</button>
              <button class="btn btn-black btn-lg" id="buy-now-btn">BUY NOW</button>
            </div>` : `
            <button class="btn btn-black btn-lg btn-full" disabled style="opacity:0.5;cursor:not-allowed;">OUT OF STOCK</button>`}

          <div class="delivery-info">
            <div class="delivery-item"><span class="icon"></span><span class="text">We Offer Campus Delivery & Pickup Around Karatina University</span></div>
            <div class="delivery-item"><span class="icon"></span><span class="text">Cash on Delivery available</span></div>
            <div class="delivery-item"><span class="icon"></span><span class="text">7 Days Return Policy</span></div>
            <div class="delivery-item"><span class="icon"></span><span class="text">100% Secure Payment</span></div>
          </div>
        </div>
      </div>
    `;

    initProductDetailInteractions(p);
    loadRelatedProducts(p.category, p.id);

  } catch {
    content.innerHTML = `<div class="empty-state"><div class="empty-state-icon"></div><h3>Product not found</h3><a href="shop.html" class="btn btn-black mt-3">Back to Shop</a></div>`;
  }
}

function initProductDetailInteractions(p) {
  /* Thumbnail clicks */
  document.querySelectorAll('#product-thumbs .product-thumb').forEach(thumb => {
    thumb.addEventListener('click', () => {
      document.querySelectorAll('#product-thumbs .product-thumb').forEach(t => t.classList.remove('active'));
      thumb.classList.add('active');
      const mainImg = document.getElementById('main-img');
      if (mainImg) {
        mainImg.style.opacity = '0';
        setTimeout(() => { mainImg.style.opacity = '1'; }, 200);
      }
    });
  });

  /* Size buttons */
  document.querySelectorAll('#size-options-container .detail-size-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#size-options-container .detail-size-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const lbl = document.getElementById('selected-size-label');
      if (lbl) lbl.textContent = ` ${btn.dataset.size}`;
    });
  });

  /* Color buttons */
  document.querySelectorAll('#color-options-container .detail-color-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#color-options-container .detail-color-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const lbl = document.getElementById('selected-color-label');
      if (lbl) lbl.textContent = `${btn.dataset.color}`;
    });
  });

  /* Quantity controls */
  const qtyInput = document.getElementById('qty-input');
  document.querySelector('.qty-minus')?.addEventListener('click', () => {
    const v = parseInt(qtyInput.value) || 1;
    if (v > 1) qtyInput.value = v - 1;
  });
  document.querySelector('.qty-plus')?.addEventListener('click', () => {
    const v   = parseInt(qtyInput.value) || 1;
    const max = parseInt(qtyInput.max) || 99;
    if (v < max) qtyInput.value = v + 1;
  });

  /* Add to cart */
  document.getElementById('add-to-cart-btn')?.addEventListener('click', async () => {
    const size  = document.querySelector('#size-options-container .detail-size-btn.active')?.dataset.size  || '';
    const color = document.querySelector('#color-options-container .detail-color-btn.active')?.dataset.color || '';
    const qty   = parseInt(qtyInput?.value) || 1;
    if (p.sizes?.length > 0 && !size) { showToast('Please select a size', 'warning'); return; }
    await addToCartAction(p, qty, size, color);
  });

  /* Buy now */
  document.getElementById('buy-now-btn')?.addEventListener('click', async () => {
    const size  = document.querySelector('#size-options-container .detail-size-btn.active')?.dataset.size  || '';
    const color = document.querySelector('#color-options-container .detail-color-btn.active')?.dataset.color || '';
    const qty   = parseInt(qtyInput?.value) || 1;
    if (p.sizes?.length > 0 && !size) { showToast('Please select a size', 'warning'); return; }
    await addToCartAction(p, qty, size, color);
    window.location.href = 'cart.html';
  });
}

async function addToCartAction(product, qty, size, color) {
  if (Auth.isLoggedIn()) {
    try {
      await CartAPI.add(product.id, qty, size, color);
      showToast(`${product.name} added to cart`, 'success');
      await updateCartBadge();
    } catch (err) {
      showToast(err.message || 'Failed to add to cart', 'error');
    }
  } else {
    LocalCart.add(product, qty, size, color);
    showToast(`${product.name} added to cart`, 'success');
    updateCartBadge();
  }
}

async function loadRelatedProducts(category, excludeId) {
  const container = document.getElementById('related-products-grid');
  if (!container) return;
  try {
    const data = await ProductAPI.getAll({ category, limit: 5 });
    const list = (data?.products || []).filter(p => p.id != excludeId).slice(0, 4);
    container.innerHTML = list.map(renderProductCard).join('');
    initQuickAddButtons();
  } catch {}
}



/* ============================================
   CART PAGE
   ============================================ */
async function initCartPage() {
  if (!document.getElementById('cart-main')) return;
  await renderCartPage();

  /* Coupon FIX: discount is now actually applied to the total */
  document.getElementById('apply-coupon-btn')?.addEventListener('click', () => {
    const code  = document.getElementById('coupon-input')?.value.trim().toUpperCase();
    const valid = { 'PAULAH10': 10, 'CAMPUS15': 15, 'KU2025': 20 };
    if (valid[code]) {
      const pct        = valid[code];
      const subtotalEl = document.getElementById('cart-subtotal');
      const rawSubtotal = parseFloat(subtotalEl?.dataset.raw || 0);
      const discounted = rawSubtotal * (1 - pct / 100);
      updateCartSummary(discounted);
      showToast(`${pct}% discount applied with code ${code}`, 'success');
    } else {
      showToast('Invalid coupon code. Try PAULAH10', 'error');
    }
  });

  document.getElementById('clear-cart-btn')?.addEventListener('click', async () => {
    if (!confirm('Clear all items?')) return;
    if (Auth.isLoggedIn()) await CartAPI.clear();
    else LocalCart.clear();
    await renderCartPage();
    await updateCartBadge();
    showToast('Cart cleared', 'info');
  });
}

async function renderCartPage() {
  const body    = document.getElementById('cart-body');
  const emptyEl = document.getElementById('cart-empty');
  const mainEl  = document.getElementById('cart-main');
  if (!body) return;

  let items = [], subtotal = 0;

  if (Auth.isLoggedIn()) {
    try {
      const d  = await CartAPI.get();
      items    = d?.cart?.items   || [];
      subtotal = d?.cart?.totalPrice || 0;
    } catch {
      items    = LocalCart.get();
      subtotal = LocalCart.getTotal();
    }
  } else {
    items    = LocalCart.get();
    subtotal = LocalCart.getTotal();
  }

  if (!items.length) {
    if (emptyEl) emptyEl.style.display = 'block';
    if (mainEl)  mainEl.style.display  = 'none';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';
  if (mainEl)  mainEl.style.display  = '';

  body.innerHTML = items.map(item => {
    const img   = getImageUrl(item.image);
    const price = parseFloat(item.price_at_add || item.price || 0);
    const key   = item.key || `${item.product_id}-${item.size||''}-${item.color||''}`;
    return `
      <tr data-key="${escHtml(key)}" data-id="${escHtml(String(item.product_id || item.id))}">
        <td>
          <div class="cart-product">
            <div class="cart-product-img">
              ${img
                ? `<img src="${escHtml(img)}" alt="${escHtml(item.name)}">`
                : `<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:1.8rem;">${getCategoryEmoji(item.category)}</div>`}
            </div>
            <div class="cart-product-info">
              <div class="name">${escHtml(item.name)}</div>
              <div class="variant">
                ${item.size  ? `Size: ${escHtml(item.size)}` : ''}
                ${item.color ? ` | Color: ${escHtml(item.color)}` : ''}
              </div>
            </div>
          </div>
        </td>
        <td><span class="cart-price">${formatKES(price)}</span></td>
        <td>
          <div class="cart-qty-control">
            <button class="cart-qty-btn cart-minus"
              data-key="${escHtml(key)}"
              data-id="${escHtml(String(item.product_id || item.id))}"
              data-size="${escHtml(item.size||'')}"
              data-color="${escHtml(item.color||'')}">-</button>
            <div class="cart-qty-num">${item.quantity}</div>
            <button class="cart-qty-btn cart-plus"
              data-key="${escHtml(key)}"
              data-id="${escHtml(String(item.product_id || item.id))}"
              data-size="${escHtml(item.size||'')}"
              data-color="${escHtml(item.color||'')}">+</button>
          </div>
        </td>
        <td><span class="cart-total-price">${formatKES(price * item.quantity)}</span></td>
        <td>
          <button class="cart-remove"
            data-key="${escHtml(key)}"
            data-id="${escHtml(String(item.product_id || item.id))}"
            data-size="${escHtml(item.size||'')}"
            data-color="${escHtml(item.color||'')}"
            title="Remove">X</button>
        </td>
      </tr>
    `;
  }).join('');

  body.querySelectorAll('.cart-minus').forEach(btn  => btn.addEventListener('click', () => changeCartQty(btn, -1)));
  body.querySelectorAll('.cart-plus').forEach(btn   => btn.addEventListener('click', () => changeCartQty(btn, +1)));
  body.querySelectorAll('.cart-remove').forEach(btn => btn.addEventListener('click', () => removeCartItem(btn)));

  updateCartSummary(subtotal);
}

async function changeCartQty(btn, delta) {
  const id    = btn.dataset.id;
  const key   = btn.dataset.key;
  const size  = btn.dataset.size  || '';
  const color = btn.dataset.color || '';
  const row   = btn.closest('tr');
  const numEl = row?.querySelector('.cart-qty-num');
  const curQty = parseInt(numEl?.textContent) || 1;
  const newQty = curQty + delta;

  if (newQty <= 0 && !confirm('Remove this item?')) return;

  try {
    if (Auth.isLoggedIn()) await CartAPI.update(id, newQty, size, color);
    else LocalCart.update(key, newQty);
    await renderCartPage();
    await updateCartBadge();
  } catch (err) {
    showToast(err.message || 'Update failed', 'error');
  }
}

async function removeCartItem(btn) {
  const id    = btn.dataset.id;
  const key   = btn.dataset.key;
  const size  = btn.dataset.size  || '';
  const color = btn.dataset.color || '';
  try {
    if (Auth.isLoggedIn()) await CartAPI.remove(id, size, color);
    else LocalCart.remove(key);
    await renderCartPage();
    await updateCartBadge();
    showToast('Item removed', 'info');
  } catch (err) {
    showToast(err.message || 'Remove failed', 'error');
  }
}
function updateCartSummary(subtotal) {
  /* ---- No delivery fee ---- */
  const total   = subtotal;
  const deposit = total * 0.20;
  const balance = total * 0.80;

  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  set('cart-subtotal', formatKES(subtotal));
  set('cart-shipping', 'FREE');
  set('cart-total',    formatKES(total));
  set('cart-deposit',  formatKES(deposit));
  set('cart-balance',  formatKES(balance));
}
/* ============================================
   CHECKOUT PAGE
   ============================================ */
async function initCheckoutPage() {
  if (!document.getElementById('checkout-items')) return;

  let items = [], subtotal = 0;
  if (Auth.isLoggedIn()) {
    try {
      const d  = await CartAPI.get();
      items    = d?.cart?.items    || [];
      subtotal = d?.cart?.totalPrice || 0;
    } catch {
      items    = LocalCart.get();
      subtotal = LocalCart.getTotal();
    }
  } else {
    items    = LocalCart.get();
    subtotal = LocalCart.getTotal();
  }

  if (!items.length) { window.location.href = 'cart.html'; return; }

  /* Render order items */
  const itemsEl = document.getElementById('checkout-items');
  if (itemsEl) {
    itemsEl.innerHTML = items.map(item => {
      const img   = getImageUrl(item.image);
      const price = parseFloat(item.price_at_add || item.price || 0);
      return `
        <div class="order-item">
          <div class="order-item-img">
            ${img
              ? `<img src="${escHtml(img)}" alt="${escHtml(item.name)}">`
              : `<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:1.5rem;">${getCategoryEmoji(item.category)}</div>`}
          </div>
          <div class="order-item-info">
            <div class="name">${escHtml(item.name)}</div>
            <div class="variant">Qty: ${item.quantity}${item.size ? ' Â· ' + escHtml(item.size) : ''}${item.color ? ' Â· ' + escHtml(item.color) : ''}</div>
          </div>
          <div class="order-item-price">${formatKES(price * item.quantity)}</div>
        </div>
      `;
    }).join('');
  }

  /* FIX: Shipping cost matches backend (KSh 350) */
  function updateCartSummary(subtotal) {
  /* ---- No delivery fee ---- */
  const total   = subtotal;
  const deposit = total * 0.20;
  const balance = total * 0.80;

  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  set('cart-subtotal', formatKES(subtotal));
  set('cart-shipping', 'FREE ðŸŽ‰');
  set('cart-total',    formatKES(total));
  set('cart-deposit',  formatKES(deposit));
  set('cart-balance',  formatKES(balance));
}

  /* Payment method toggle */
  document.querySelectorAll('.payment-option').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.payment-option').forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      opt.querySelector('input[type="radio"]').checked = true;
      const mpesaBox = document.getElementById('mpesa-details');
      if (mpesaBox) mpesaBox.style.display = opt.dataset.method === 'mpesa' ? 'block' : 'none';
    });
  });

  /* Checkout form submit */
  document.getElementById('checkout-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.target.querySelector('[type="submit"]');
    btn.classList.add('loading');
    btn.disabled = true;

    /* FIX: redirect to login rather than silently failing */
    if (!Auth.isLoggedIn()) {
      showToast('Please log in to place an order', 'warning');
      setTimeout(() => window.location.href = `login.html?redirect=checkout.html`, 1500);
      btn.classList.remove('loading');
      btn.disabled = false;
      return;
    }

    const fd = new FormData(e.target);
    try {
      const result = await OrderAPI.place({
        shippingAddress: {
          fullName: fd.get('fullName'),
          phone:    fd.get('phone'),
          street:   fd.get('street') || fd.get('hostel') || '',
          city:     fd.get('city')   || 'Karatina',
          county:   fd.get('county') || 'Kirinyaga',
          country:  'Kenya',
        },
        paymentMethod:    fd.get('payment')   || 'Cash on Delivery',
                deliveryNotes:    fd.get('notes')     || '',
      });
      LocalCart.clear();
      await updateCartBadge();
      showToast(`Order placed! Tracking: ${result.order.tracking_number} âœ“`, 'success', 6000);
      setTimeout(() => window.location.href = 'orders.html', 2500);
    } catch (err) {
      showToast(err.message || 'Order failed. Try again.', 'error');
      /* FIX: always re-enable the button on error */
      btn.classList.remove('loading');
      btn.disabled = false;
    }
  });
}

/* ============================================
   LOGIN PAGE
   ============================================ */
function initLoginPage() {
  const redirect = new URLSearchParams(window.location.search).get('redirect');
  if (Auth.isLoggedIn()) {
    window.location.href = redirect || (Auth.isAdmin() ? 'admin.html' : 'index.html');
    return;
  }

  document.getElementById('login-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const btn   = e.target.querySelector('[type="submit"]');
    const email = document.getElementById('login-email')?.value.trim();
    const pass  = document.getElementById('login-password')?.value;
    btn.classList.add('loading');
    btn.disabled = true;

    try {
      const data = await AuthAPI.login({ email, password: pass });
      Auth.setToken(data.token);
      Auth.setUser(data.user);

      /* Merge guest cart into server cart */
      const local = LocalCart.get();
      for (const item of local) {
        try { await CartAPI.add(item.product_id, item.quantity, item.size || '', item.color || ''); }
        catch {}
      }
      LocalCart.clear();

      showToast(`Welcome back, ${data.user.name.split(' ')[0]}!`, 'success');

      /* Redirect back to page user came from, if any */
      const params   = new URLSearchParams(window.location.search);
      const redirect = params.get('redirect');
      setTimeout(() => {
        window.location.href = redirect || (data.user.role === 'admin' ? 'admin.html' : 'index.html');
      }, 1000);

    } catch (err) {
      showToast(err.message || 'Invalid email or password', 'error');
      btn.classList.remove('loading');
      btn.disabled = false;
    }
  });

  /* Password visibility toggle */
  document.querySelectorAll('.password-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const field    = btn.previousElementSibling;
      field.type     = field.type === 'password' ? 'text' : 'password';
      btn.textContent = field.type === 'text' ? 'ðŸ™ˆ' : 'ðŸ‘';
    });
  });
}

/* ============================================
   REGISTER PAGE
   ============================================ */
function initRegisterPage() {
  const redirect = new URLSearchParams(window.location.search).get('redirect');
  if (Auth.isLoggedIn()) { window.location.href = redirect || 'index.html'; return; }

  document.getElementById('register-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const btn   = e.target.querySelector('[type="submit"]');
    const fname = document.getElementById('reg-fname')?.value.trim();
    const lname = document.getElementById('reg-lname')?.value.trim();
    const email = document.getElementById('reg-email')?.value.trim();
    const phone = document.getElementById('reg-phone')?.value.trim();
    const pass  = document.getElementById('reg-password')?.value;
    const conf  = document.getElementById('reg-confirm')?.value;

    if (pass !== conf) { showToast('Passwords do not match', 'error'); return; }
    if (pass.length < 6) { showToast('Password must be at least 6 characters', 'error'); return; }
    if (!fname || !lname) { showToast('Please enter your full name', 'error'); return; }

    btn.classList.add('loading');
    btn.disabled = true;
    try {
      const data = await AuthAPI.register({ name: `${fname} ${lname}`, email, password: pass, phone });
      Auth.setToken(data.token);
      Auth.setUser(data.user);
      showToast(`Account created! Welcome, ${fname}! ðŸŽ‰`, 'success');
      setTimeout(() => window.location.href = redirect || 'index.html', 1200);
    } catch (err) {
      showToast(err.message || 'Registration failed', 'error');
      btn.classList.remove('loading');
      btn.disabled = false;
    }
  });
}

/* ============================================
   FORGOT PASSWORD PAGE
   ============================================ */
function initForgotPasswordPage() {
  if (Auth.isLoggedIn()) { window.location.href = 'index.html'; return; }

  document.getElementById('forgot-password-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.target.querySelector('[type="submit"]');
    const email = document.getElementById('forgot-email')?.value.trim();

    btn.classList.add('loading');
    btn.disabled = true;

    try {
      const data = await AuthAPI.forgotPassword({ email });
      const result = document.getElementById('reset-result');
      showToast(data.message || 'Password reset instructions are ready.', 'success');

      if (result) {
        result.style.display = 'block';
        result.textContent = data.resetUrl
          ? `Reset link: ${data.resetUrl}`
          : 'If that email exists, reset instructions are ready.';
      }
    } catch (err) {
      showToast(err.message || 'Could not start password reset', 'error');
    } finally {
      btn.classList.remove('loading');
      btn.disabled = false;
    }
  });
}

/* ============================================
   RESET PASSWORD PAGE
   ============================================ */
function initResetPasswordPage() {
  if (Auth.isLoggedIn()) { window.location.href = 'index.html'; return; }

  const token = new URLSearchParams(window.location.search).get('token');
  const tokenInput = document.getElementById('reset-token');
  if (tokenInput) tokenInput.value = token || '';

  if (!token) {
    showToast('Reset link is missing a token.', 'error');
  }

  document.getElementById('reset-password-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.target.querySelector('[type="submit"]');
    const password = document.getElementById('reset-password')?.value || '';
    const confirm = document.getElementById('reset-confirm')?.value || '';

    if (password !== confirm) { showToast('Passwords do not match', 'error'); return; }
    if (password.length < 8) { showToast('Password must be at least 8 characters', 'error'); return; }

    btn.classList.add('loading');
    btn.disabled = true;

    try {
      const data = await AuthAPI.resetPassword({ token: tokenInput?.value || token, password });
      showToast(data.message || 'Password reset successfully.', 'success');
      setTimeout(() => window.location.href = 'login.html', 1200);
    } catch (err) {
      showToast(err.message || 'Could not reset password', 'error');
      btn.classList.remove('loading');
      btn.disabled = false;
    }
  });

  document.querySelectorAll('.password-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const field = btn.previousElementSibling;
      field.type = field.type === 'password' ? 'text' : 'password';
      btn.textContent = field.type === 'text' ? 'Hide' : 'Show';
    });
  });
}

/* ============================================
   ORDERS PAGE
   ============================================ */
async function initOrdersPage() {
  const container = document.getElementById('orders-container');
  if (!container) return;
  if (!Auth.isLoggedIn()) { window.location.href = 'login.html'; return; }

  container.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Loading your orders...</p></div>`;

  try {
    const data   = await OrderAPI.getMyOrders();
    const orders = data?.orders || [];

    if (!orders.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">ðŸ“¦</div>
          <h3>No orders yet</h3>
          <p>When you place an order, it will appear here.</p>
          <a href="shop.html" class="btn btn-black mt-3">Start Shopping</a>
        </div>`;
      return;
    }

    container.innerHTML = orders.map(o => `
      <div class="admin-card">
        <div class="admin-card-header">
          <div>
            <h4 style="font-size:14px;">Order #${escHtml(o.tracking_number || String(o.id))}</h4>
            <p style="font-size:12px;color:var(--text-muted);margin-top:2px;">${formatDate(o.created_at)}</p>
          </div>
          <div style="display:flex;align-items:center;gap:12px;">
            <span class="status-badge ${escHtml(o.order_status?.toLowerCase())}">${escHtml(o.order_status)}</span>
            <span style="font-size:14px;font-weight:800;">${formatKES(o.total_price)}</span>
          </div>
        </div>
        <div class="admin-card-body">
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;font-size:13px;">
            <div><div style="color:var(--text-muted);margin-bottom:2px;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Items</div><div style="font-weight:700;">${o.item_count || 'â€”'}</div></div>
            <div><div style="color:var(--text-muted);margin-bottom:2px;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Payment</div><div style="font-weight:700;">${escHtml(o.payment_method)}</div></div>
            <div><div style="color:var(--text-muted);margin-bottom:2px;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Deposit</div><div style="font-weight:700;">${formatKES(o.deposit_amount)}</div></div>
            <div><div style="color:var(--text-muted);margin-bottom:2px;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Balance</div><div style="font-weight:700;">${formatKES(o.balance_due)}</div></div>
          </div>
        </div>
      </div>
    `).join('');

  } catch (err) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">âš ï¸</div><p>${escHtml(err.message)}</p></div>`;
  }
}

/* ============================================
   CONTACT PAGE
   ============================================ */
function initContactPage() {
  document.getElementById('contact-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.target.querySelector('[type="submit"]');
    btn.classList.add('loading');
    btn.disabled = true;
    await new Promise(r => setTimeout(r, 1200));
    showToast("Message sent! We'll get back to you soon âœ“", 'success');
    e.target.reset();
    btn.classList.remove('loading');
    btn.disabled = false;
  });
}

/* ============================================
   QUICK ADD + WISHLIST BUTTONS
   ============================================ */
const WishlistStore = {
  KEY: 'ps_wishlist',
  get: () => {
    try { return JSON.parse(localStorage.getItem('ps_wishlist')) || []; }
    catch { return []; }
  },
  save: (ids) => localStorage.setItem('ps_wishlist', JSON.stringify([...new Set(ids.map(String))])),
  has: (id) => WishlistStore.get().includes(String(id)),
  toggle: (id) => {
    const key = String(id);
    const items = WishlistStore.get();
    const exists = items.includes(key);
    WishlistStore.save(exists ? items.filter(x => x !== key) : [...items, key]);
    return !exists;
  },
};

function initQuickAddButtons() {
  document.querySelectorAll('.quick-add-btn').forEach(btn => {
    /* Skip out-of-stock buttons (have the out-of-stock class) */
    if (btn.classList.contains('out-of-stock')) return;
    btn.addEventListener('click', async e => {
      e.preventDefault();
      e.stopPropagation();
      const card = btn.closest('.product-card');
      if (!card) return;
      const product = {
        id:       card.dataset.id,
        name:     card.dataset.name,
        price:    parseFloat(card.dataset.price),
        category: card.dataset.category,
        image:    card.dataset.image || '',
        stock:    parseInt(card.dataset.stock) || 0,
      };
      if (product.stock === 0) { showToast('Out of stock', 'warning'); return; }
      await addToCartAction(product, 1, '', '');
    });
  });
}

function initWishlistButtons() {
  document.querySelectorAll('.wishlist-btn').forEach(btn => {
    const card = btn.closest('.product-card');
    const id = card?.dataset.id;
    if (id && WishlistStore.has(id)) {
      btn.classList.add('active');
      btn.textContent = 'â™¥';
    }

    btn.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      const card = btn.closest('.product-card');
      const id = card?.dataset.id;
      const active = id ? WishlistStore.toggle(id) : !btn.classList.contains('active');
      btn.classList.toggle('active', active);
      btn.textContent = active ? 'â™¥' : 'â™¡';
      showToast(active ? 'Added to wishlist â™¥' : 'Removed from wishlist', 'info');
    });
  });
}

/* ============================================
   NEWSLETTER
   ============================================ */
function initNewsletter() {
  document.querySelector('.newsletter-form')?.addEventListener('submit', e => {
    e.preventDefault();
    const input = e.target.querySelector('input');
    if (input?.value.trim()) {
      showToast('Subscribed! Check your email for your discount code ðŸŽ‰', 'success');
      input.value = '';
    }
  });
}

/* ============================================
   ADMIN DASHBOARD
   ============================================ */
async function initAdminDashboard() {
  /* FIX: double-check both isLoggedIn AND isAdmin before rendering anything */
  if (!Auth.isLoggedIn() || !Auth.isAdmin()) {
    window.location.href = 'login.html';
    return;
  }

  const user = Auth.getUser();
  document.querySelectorAll('.admin-user-name-el').forEach(el => {
    el.textContent = user?.name || 'Admin';
  });

  initAdminNav();
  loadAdminSection('overview');

  document.getElementById('admin-logout')?.addEventListener('click', Auth.logout);
  document.getElementById('admin-sidebar-toggle')?.addEventListener('click', () => {
    document.getElementById('admin-sidebar')?.classList.toggle('open');
  });
}

function initAdminNav() {
  document.querySelectorAll('.admin-nav-link[data-section]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      document.querySelectorAll('.admin-nav-link').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      loadAdminSection(link.dataset.section);
      document.getElementById('admin-sidebar')?.classList.remove('open');
    });
  });
}

function loadAdminSection(section) {
  const content = document.getElementById('admin-content');
  if (!content) return;
  const topbarTitle = document.getElementById('admin-topbar-title');
  const titles = { overview: 'Dashboard', products: 'Products', orders: 'Orders', customers: 'Customers', 'add-product': 'Add Product' };
  if (topbarTitle) topbarTitle.querySelector('h4').textContent = titles[section] || section;

  const sections = {
    overview:       renderAdminOverview,
    products:       renderAdminProducts,
    orders:         renderAdminOrders,
    customers:      renderAdminCustomers,
    'add-product':  (c) => renderAddProductForm(c, null),
  };
  (sections[section] || renderAdminOverview)(content);
}

async function renderAdminOverview(container) {
  container.innerHTML = `<div class="loading-state"><div class="spinner"></div></div>`;
  let stats = { pending: 0, revenue: 0, delivered: 0 };
  let productCount = 0, orderCount = 0;
  try {
    const [oData, pData] = await Promise.all([
      OrderAPI.getAll({ limit: 1 }),
      ProductAPI.getAll({ limit: 1 }),
    ]);
    stats        = oData?.summary || stats;
    orderCount   = oData?.total   || 0;
    productCount = pData?.total   || 0;
  } catch {}

  container.innerHTML = `
    <div class="admin-stats">
      <div class="stat-card">
        <div class="stat-card-top"><div class="stat-card-icon black">ðŸ“¦</div><span class="stat-change up">Live</span></div>
        <div class="num">${productCount}</div>
        <div class="label">Total Products</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-top"><div class="stat-card-icon black">ðŸ›’</div><span class="stat-change up">+${stats.pending||0} pending</span></div>
        <div class="num">${orderCount}</div>
        <div class="label">Total Orders</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-top"><div class="stat-card-icon accent">ðŸ’°</div></div>
        <div class="num">${formatKES(stats.revenue||0)}</div>
        <div class="label">Total Revenue</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-top"><div class="stat-card-icon light">âœ“</div><span class="stat-change up">Delivered</span></div>
        <div class="num">${stats.delivered||0}</div>
        <div class="label">Completed Orders</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
      <div class="admin-card">
        <div class="admin-card-header"><h4>Recent Orders</h4><button class="btn btn-sm btn-outline" onclick="loadAdminSection('orders')">View All</button></div>
        <div class="admin-card-body" id="recent-orders-body"><div class="spinner"></div></div>
      </div>
      <div class="admin-card">
        <div class="admin-card-header"><h4>Products by Category</h4></div>
        <div class="admin-card-body" id="category-stats-body"><div class="spinner"></div></div>
      </div>
    </div>
  `;

  /* Load recent orders */
  try {
    const data   = await OrderAPI.getAll({ limit: 5 });
    const orders = data?.orders || [];
    document.getElementById('recent-orders-body').innerHTML = orders.length ? `
      <table class="admin-table">
        <thead><tr><th>Order ID</th><th>Customer</th><th>Total</th><th>Status</th></tr></thead>
        <tbody>
          ${orders.map(o => `
            <tr>
              <td style="font-weight:700;">#${escHtml(o.tracking_number || String(o.id))}</td>
              <td>${escHtml(o.customer_name || o.full_name || 'â€”')}</td>
              <td style="font-weight:700;">${formatKES(o.total_price)}</td>
              <td><span class="status-badge ${escHtml(o.order_status?.toLowerCase())}">${escHtml(o.order_status)}</span></td>
            </tr>`).join('')}
        </tbody>
      </table>
    ` : '<p style="color:var(--text-muted);font-size:13px;">No orders yet.</p>';
  } catch {}

  /* Category stats */
  try {
    const data = await ProductAPI.getAll({ limit: 100 });
    const cats = {};
    (data?.products || []).forEach(p => { cats[p.category] = (cats[p.category] || 0) + 1; });
    document.getElementById('category-stats-body').innerHTML =
      Object.entries(cats).map(([cat, count]) => `
        <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border);">
          <span style="font-size:20px;">${getCategoryEmoji(cat)}</span>
          <div style="flex:1;">
            <div style="font-size:13px;font-weight:700;text-transform:capitalize;">${escHtml(cat)}</div>
            <div style="height:4px;background:var(--border);border-radius:2px;margin-top:4px;overflow:hidden;">
              <div style="height:100%;background:var(--black);width:${Math.min(count * 10, 100)}%;border-radius:2px;"></div>
            </div>
          </div>
          <span style="font-size:13px;font-weight:800;">${count}</span>
        </div>`).join('') || '<p style="color:var(--text-muted);font-size:13px;">No products yet.</p>';
  } catch {}
}

async function renderAdminProducts(container) {
  container.innerHTML = `<div class="loading-state"><div class="spinner"></div></div>`;
  try {
    const data     = await ProductAPI.getAll({ limit: 50 });
    const products = data?.products || [];
    container.innerHTML = `
      <div class="admin-card">
        <div class="admin-card-header">
          <h4>${data?.total || 0} Products</h4>
          <button class="btn btn-black btn-sm" onclick="loadAdminSection('add-product')">+ Add Product</button>
        </div>
        <div class="admin-card-body" style="padding:0;">
          <table class="admin-table">
            <thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              ${products.map(p => `
                <tr>
                  <td>
                    <div style="display:flex;align-items:center;gap:10px;">
                      <div style="width:44px;height:44px;border-radius:var(--radius-sm);overflow:hidden;background:var(--light-gray);flex-shrink:0;">
                        ${getImageUrl(p.image)
                          ? `<img src="${escHtml(getImageUrl(p.image))}" style="width:100%;height:100%;object-fit:cover;">`
                          : `<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:1.2rem;">${getCategoryEmoji(p.category)}</div>`}
                      </div>
                      <div>
                        <div style="font-size:13px;font-weight:700;">${escHtml(p.name)}</div>
                        <div style="font-size:11px;color:var(--text-muted);">ID: ${p.id}</div>
                      </div>
                    </div>
                  </td>
                  <td><span style="font-size:12px;text-transform:capitalize;">${escHtml(p.category)}</span></td>
                  <td style="font-weight:700;">${formatKES(p.price)}</td>
                  <td><span style="font-weight:700;color:${p.stock > 10 ? 'var(--green)' : p.stock > 0 ? '#f5a623' : 'var(--red)'};">${p.stock}</span></td>
                  <td><span class="status-badge ${p.is_active ? 'active' : 'inactive'}">${p.is_active ? 'Active' : 'Inactive'}</span></td>
                  <td>
                    <div style="display:flex;gap:6px;">
                      <button class="btn btn-sm btn-outline" onclick="editProduct(${p.id})">Edit</button>
                      <button class="btn btn-sm" style="background:rgba(229,57,53,0.08);color:var(--red);border:1px solid rgba(229,57,53,0.2);" onclick="deleteProduct(${p.id}, ${JSON.stringify(escHtml(p.name))})">Delete</button>
                    </div>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">âš ï¸</div><p>${escHtml(err.message)}</p></div>`;
  }
}

async function renderAddProductForm(container, existingProduct = null) {
  const isEdit = !!existingProduct;
  const p      = existingProduct || {};
  container.innerHTML = `
    <div class="admin-card">
      <div class="admin-card-header">
        <h4>${isEdit ? 'Edit Product' : 'Add New Product'}</h4>
        <button class="btn btn-sm btn-outline" onclick="loadAdminSection('products')">â† Back</button>
      </div>
      <div class="admin-card-body">
        <form id="product-form">
          <div class="admin-form-grid">
            <div class="form-group">
              <label class="form-label">Product Name *</label>
              <input type="text" name="name" class="form-input" placeholder="e.g. Air Classic Sneakers" value="${escHtml(p.name||'')}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Category *</label>
              <select name="category" class="form-select form-input" required>
                <option value="">Select category</option>
                ${['shoes','hoodie','tshirt','jeans','dress','accessories','other'].map(c =>
                  `<option value="${c}" ${p.category===c?'selected':''}>${c.charAt(0).toUpperCase()+c.slice(1)}</option>`
                ).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Price (KSh) *</label>
              <input type="number" name="price" class="form-input" placeholder="3500" value="${escHtml(String(p.price||''))}" min="0" step="1" required>
            </div>
            <div class="form-group">
              <label class="form-label">Original Price (KSh) â€” for sale display</label>
              <input type="number" name="originalPrice" class="form-input" placeholder="4500" value="${escHtml(String(p.original_price||''))}" min="0" step="1">
            </div>
            <div class="form-group">
              <label class="form-label">Stock Quantity *</label>
              <input type="number" name="stock" class="form-input" placeholder="10" value="${escHtml(String(p.stock||''))}" min="0" required>
            </div>
            <div class="form-group">
              <label class="form-label">Sizes (comma separated)</label>
              <input type="text" name="sizes" class="form-input" placeholder="XS,S,M,L,XL" value="${escHtml(Array.isArray(p.sizes)?p.sizes.join(','):(p.sizes||''))}">
            </div>
            <div class="form-group">
              <label class="form-label">Colors (comma separated)</label>
              <input type="text" name="colors" class="form-input" placeholder="Black,White,Grey" value="${escHtml(Array.isArray(p.colors)?p.colors.join(','):(p.colors||''))}">
            </div>
            <div class="form-group">
              <label class="form-label">Featured Product</label>
              <select name="isFeatured" class="form-select form-input">
                <option value="false" ${!p.is_featured?'selected':''}>No</option>
                <option value="true"  ${p.is_featured?'selected':''}>Yes</option>
              </select>
            </div>
          </div>
          <div class="form-group" style="margin-top:16px;">
            <label class="form-label">Description *</label>
            <textarea name="description" class="form-input" rows="4" placeholder="Product description..." required>${escHtml(p.description||'')}</textarea>
          </div>
          <div class="form-group" style="margin-top:16px;">
            <label class="form-label">Product Image</label>
            <div class="image-upload-area" onclick="document.getElementById('product-image-input').click()">
              <div class="image-upload-icon">ðŸ“·</div>
              <div class="image-upload-text">Click to upload image (max 5MB, JPG/PNG/WebP)</div>
              <input type="file" id="product-image-input" name="image" accept="image/jpeg,image/png,image/webp" style="display:none;" onchange="previewProductImage(this)">
            </div>
            <div id="image-preview" style="margin-top:10px;"></div>
            ${p.image && p.image !== 'default-product.png'
              ? `<div style="margin-top:8px;"><img src="${escHtml(getImageUrl(p.image))}" style="width:80px;height:80px;object-fit:cover;border-radius:var(--radius-sm);border:1px solid var(--border);" alt="Current"><p style="font-size:11px;color:var(--text-muted);margin-top:4px;">Current image (upload new to replace)</p></div>`
              : ''}
          </div>
          <div style="display:flex;gap:12px;margin-top:20px;">
            <button type="submit" class="btn btn-black btn-lg">${isEdit ? 'Update Product' : 'Add Product'}</button>
            <button type="button" class="btn btn-outline btn-lg" onclick="loadAdminSection('products')">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  `;

  /* Form submit */
  document.getElementById('product-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.target.querySelector('[type="submit"]');
    btn.classList.add('loading');
    btn.disabled = true;
    const formData = new FormData(e.target);
    try {
      if (isEdit) {
        await ProductAPI.update(p.id, formData);
        showToast('Product updated successfully âœ“', 'success');
      } else {
        await ProductAPI.create(formData);
        showToast('Product added successfully âœ“', 'success');
      }
      setTimeout(() => loadAdminSection('products'), 1200);
    } catch (err) {
      showToast(err.message || 'Failed to save product', 'error');
      btn.classList.remove('loading');
      btn.disabled = false;
    }
  });
}

/* Image preview */
window.previewProductImage = (input) => {
  const preview = document.getElementById('image-preview');
  if (!preview || !input.files[0]) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = document.createElement('img');
    img.src   = e.target.result;
    img.style.cssText = 'width:100px;height:100px;object-fit:cover;border-radius:var(--radius-sm);border:1px solid var(--border);';
    img.alt   = 'Preview';
    preview.innerHTML = '';
    preview.appendChild(img);
  };
  reader.readAsDataURL(input.files[0]);
};

/* Edit product */
window.editProduct = async (id) => {
  try {
    const data    = await ProductAPI.getById(id);
    const content = document.getElementById('admin-content');
    renderAddProductForm(content, data.product);
  } catch (err) {
    showToast(err.message || 'Failed to load product', 'error');
  }
};

/* Delete product */
window.deleteProduct = async (id, name) => {
  if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
  try {
    await ProductAPI.delete(id);
    showToast(`"${name}" deleted âœ“`, 'success');
    loadAdminSection('products');
  } catch (err) {
    showToast(err.message || 'Delete failed', 'error');
  }
};

async function renderAdminOrders(container) {
  container.innerHTML = `<div class="loading-state"><div class="spinner"></div></div>`;
  try {
    const data   = await OrderAPI.getAll({ limit: 50 });
    const orders = data?.orders || [];
    container.innerHTML = `
      <div class="admin-card">
        <div class="admin-card-header">
          <h4>${data?.total || 0} Orders</h4>
          <select id="order-status-filter" class="form-select" style="padding:8px 12px;font-size:13px;" onchange="filterOrders(this.value)">
            <option value="">All Status</option>
            <option value="Pending">Pending</option>
            <option value="Confirmed">Confirmed</option>
            <option value="Processing">Processing</option>
            <option value="Shipped">Shipped</option>
            <option value="Delivered">Delivered</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>
        <div class="admin-card-body" style="padding:0;">
          <table class="admin-table" id="orders-table">
            <thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Total</th><th>Deposit</th><th>Payment</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody id="orders-tbody">
              ${renderOrderRows(orders)}
            </tbody>
          </table>
        </div>
      </div>`;
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">âš ï¸</div><p>${escHtml(err.message)}</p></div>`;
  }
}

/* Shared row renderer â€” used by both renderAdminOrders and filterOrders */
function renderOrderRows(orders) {
  if (!orders.length) return `<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--text-muted);">No orders found.</td></tr>`;
  return orders.map(o => `
    <tr>
      <td style="font-weight:700;">#${escHtml(o.tracking_number || String(o.id))}</td>
      <td>
        <div style="font-size:13px;font-weight:600;">${escHtml(o.customer_name || o.full_name || 'â€”')}</div>
        <div style="font-size:11px;color:var(--text-muted);">${escHtml(o.customer_email || o.phone || '')}</div>
      </td>
      <td style="font-size:12px;color:var(--text-muted);">${formatDate(o.created_at)}</td>
      <td style="font-weight:800;">${formatKES(o.total_price)}</td>
      <td style="font-weight:600;color:var(--green);">${formatKES(o.deposit_amount)}</td>
      <td><span class="status-badge ${escHtml(o.payment_status?.toLowerCase().replace(' ', '-'))}">${escHtml(o.payment_status)}</span></td>
      <td><span class="status-badge ${escHtml(o.order_status?.toLowerCase())}">${escHtml(o.order_status)}</span></td>
      <td>
        <select style="padding:6px 10px;border:1px solid var(--border);border-radius:var(--radius-sm);font-size:12px;cursor:pointer;" onchange="updateOrderStatus(${o.id}, this.value)">
          <option value="">Update...</option>
          <option value="Confirmed">Confirmed</option>
          <option value="Processing">Processing</option>
          <option value="Shipped">Shipped</option>
          <option value="Delivered">Delivered</option>
          <option value="Cancelled">Cancelled</option>
        </select>
      </td>
    </tr>`).join('');
}

window.updateOrderStatus = async (id, status) => {
  if (!status) return;
  try {
    await OrderAPI.updateStatus(id, { orderStatus: status });
    showToast(`Order updated to ${status} âœ“`, 'success');
    /* FIX: reload just the tbody instead of the whole section to preserve the filter */
    const filter = document.getElementById('order-status-filter')?.value || '';
    const data   = await OrderAPI.getAll({ status: filter || undefined, limit: 50 });
    const tbody  = document.getElementById('orders-tbody');
    if (tbody) tbody.innerHTML = renderOrderRows(data?.orders || []);
  } catch (err) {
    showToast(err.message || 'Update failed', 'error');
  }
};

/* FIX: filterOrders now has try/catch so errors don't silently kill the table */
window.filterOrders = async (status) => {
  try {
    const data  = await OrderAPI.getAll({ status: status || undefined, limit: 50 });
    const tbody = document.getElementById('orders-tbody');
    if (tbody) tbody.innerHTML = renderOrderRows(data?.orders || []);
  } catch (err) {
    showToast(err.message || 'Filter failed', 'error');
  }
};

async function renderAdminCustomers(container) {
  container.innerHTML = `
    <div class="admin-card">
      <div class="admin-card-header"><h4>Customers</h4></div>
      <div class="admin-card-body">
        <div class="empty-state">
          <div class="empty-state-icon">ðŸ‘¥</div>
          <h3>Customer management</h3>
          <p>Customer list feature coming soon.</p>
        </div>
      </div>
    </div>`;
}

/* ============================================
   M-PESA STK PUSH â€” Checkout Integration
   ============================================ */

/* Global variable to track payment */
let mpesaCheckoutId   = null;
let mpesaPollingTimer = null;
let mpesaPaymentDone  = false;
let mpesaPendingOrder = null;

async function initiateSTKPush() {
  /* ---- Check login ---- */
  if (!Auth.isLoggedIn()) {
    showToast('Please log in to make a payment', 'warning');
    setTimeout(() => window.location.href = 'login.html', 1500);
    return;
  }

  const phone     = document.getElementById('mpesa-phone')?.value.trim();
  const depositEl = document.getElementById('co-deposit');
  const statusEl  = document.getElementById('mpesa-status');
  const btn       = document.getElementById('pay-deposit-btn');

  /* ---- Validate phone ---- */
  if (!phone) {
    showToast('Please enter your M-Pesa phone number', 'warning');
    document.getElementById('mpesa-phone')?.focus();
    return;
  }

  /* ---- Get deposit amount ---- */
  const depositText = depositEl?.textContent || '0';
  const amount      = parseFloat(depositText.replace(/[^0-9.]/g, '')) || 0;

  if (amount <= 0) {
    showToast('Please add items to cart first', 'warning');
    return;
  }

  /* ---- Show loading state ---- */
  btn.classList.add('loading');
  btn.disabled    = true;
  btn.textContent = 'Sending prompt...';

  statusEl.style.display    = 'block';
  statusEl.style.background = 'rgba(56,189,248,0.1)';
  statusEl.style.border     = '1px solid rgba(56,189,248,0.3)';
  statusEl.style.color      = '#0369a1';
  statusEl.innerHTML        = 'ðŸ“± Sending M-Pesa prompt to <strong>' + phone + '</strong>...';

  try {
    /* ---- Call backend STK Push ---- */
    const data = await apiRequest('/mpesa/stkpush', 'POST', {
      phone,
      amount:      amount,
      description: 'Paulah Styles Deposit',
    }, true);

    if (data.success) {
      mpesaCheckoutId = data.checkoutRequestId;

      /* ---- Update UI ---- */
      btn.textContent = 'â³ Waiting for payment...';

      statusEl.innerHTML = `
        <div style="font-size:1.5rem;margin-bottom:6px;">ðŸ“²</div>
        <strong>Check your phone!</strong><br>
        Enter your M-Pesa PIN to pay <strong>KSh ${amount.toLocaleString()}</strong><br>
        <span style="font-size:11px;color:var(--text-muted);margin-top:4px;display:block;">
          Waiting for confirmation... (expires in 2 minutes)
        </span>
      `;

      showToast('M-Pesa prompt sent! Enter your PIN on your phone ðŸ“±', 'success', 6000);

      /* ---- Start polling to check payment status ---- */
      startMpesaPolling(data.checkoutRequestId);

    } else {
      throw new Error(data.message || 'STK Push failed');
    }

  } catch (err) {
    console.error('STK Push error:', err);

    statusEl.style.background = 'rgba(239,68,68,0.08)';
    statusEl.style.border     = '1px solid rgba(239,68,68,0.2)';
    statusEl.style.color      = 'var(--error)';
    statusEl.innerHTML        = 'âŒ ' + (err.message || 'Failed to send M-Pesa prompt. Try again.');

    btn.classList.remove('loading');
    btn.disabled    = false;
    btn.textContent = 'ðŸ“± Pay Deposit via M-Pesa';

    showToast(err.message || 'M-Pesa failed. Try again.', 'error', 5000);
  }
}

/* ---- Poll every 5 seconds to check if paid ---- */
function startMpesaPolling(checkoutRequestId) {
  let attempts   = 0;
  const maxTries = 24; /* 24 Ã— 5s = 2 minutes */

  mpesaPollingTimer = setInterval(async () => {
    attempts++;

    try {
      const data = await apiRequest('/mpesa/query', 'POST', {
        checkoutRequestId,
      }, true);

      if (data.paid) {
        /* ---- PAYMENT CONFIRMED ---- */
        clearInterval(mpesaPollingTimer);
        mpesaPaymentDone = true;
        onMpesaPaymentConfirmed();

      } else if (data.message?.includes('cancel') || data.message?.includes('Cancel')) {
        /* ---- CANCELLED ---- */
        clearInterval(mpesaPollingTimer);
        onMpesaPaymentCancelled();

      } else if (attempts >= maxTries) {
        /* ---- TIMEOUT ---- */
        clearInterval(mpesaPollingTimer);
        onMpesaPaymentTimeout();
      }

    } catch {
      /* Ignore polling errors â€” keep trying */
    }

  }, 5000); /* Check every 5 seconds */
}

function onMpesaPaymentConfirmed() {
  const statusEl    = document.getElementById('mpesa-status');
  const confirmedEl = document.getElementById('mpesa-confirmed');
  const btn         = document.getElementById('pay-deposit-btn');

  if (statusEl)    statusEl.style.display    = 'none';
  if (confirmedEl) confirmedEl.style.display = 'block';
  if (btn)         btn.style.display         = 'none';

  showToast('ðŸŽ‰ M-Pesa payment confirmed! Now place your order.', 'success', 8000);

  /* ---- Enable the place order button ---- */
  const submitBtn = document.getElementById('checkout-submit-btn');
  if (submitBtn) {
    submitBtn.disabled      = false;
    submitBtn.style.opacity = '1';
    submitBtn.textContent   = 'âœ… Place Order';
  }
}

function onMpesaPaymentCancelled() {
  const statusEl = document.getElementById('mpesa-status');
  const btn      = document.getElementById('pay-deposit-btn');

  if (statusEl) {
    statusEl.style.background = 'rgba(239,68,68,0.08)';
    statusEl.style.border     = '1px solid rgba(239,68,68,0.2)';
    statusEl.style.color      = 'var(--error)';
    statusEl.innerHTML        = 'âŒ Payment was cancelled. Please try again.';
  }

  if (btn) {
    btn.classList.remove('loading');
    btn.disabled    = false;
    btn.textContent = 'ðŸ“± Pay Deposit via M-Pesa';
  }

  showToast('Payment cancelled. Try again.', 'warning');
}

function onMpesaPaymentTimeout() {
  const statusEl = document.getElementById('mpesa-status');
  const btn      = document.getElementById('pay-deposit-btn');

  if (statusEl) {
    statusEl.innerHTML = 'â° Payment timed out. Please try again.';
  }

  if (btn) {
    btn.classList.remove('loading');
    btn.disabled    = false;
    btn.textContent = 'ðŸ“± Try Again';
  }

  showToast('Payment timed out. Please try again.', 'warning');
}
/* ============================================
   DOM READY
   ============================================ */
document.addEventListener('DOMContentLoaded', async () => {
  initNavbar();
  initScrollTop();
  initCountdown();
  initNewsletter();
  initContactPage();

  const page = window.location.pathname.split('/').pop() || 'index.html';
  const pageMap = {
    'index.html':    initHomepage,
    '':              initHomepage,
    'shop.html':     initShopPage,
    'product.html':  initProductPage,
    'cart.html':     initCartPage,
    'checkout.html': initCheckoutPage,
    'login.html':    initLoginPage,
    'register.html': initRegisterPage,
    'forgot-password.html': initForgotPasswordPage,
    'reset-password.html':  initResetPasswordPage,
    'orders.html':   initOrdersPage,
    'contact.html':  initContactPage,
    'admin.html':    initAdminDashboard,
  };
  await pageMap[page]?.();
  updateCartBadge().catch(() => {});
});

