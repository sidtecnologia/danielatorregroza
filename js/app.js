const { /* keep for compatibility if supabase global exists */ } = {};

// Variables globales de configuración (se completan en init)
let SB_URL = null;
let SB_ANON_KEY = null;
let supabaseClient = null;
let createClientFunc = null;

// --- Variables de estado ---
let cart = [];
let products = [];
let currentImageIndex = 0;
let currentProduct = null;
let deferredPrompt = null;
const PRODUCTS_PER_PAGE = 25;
let orderDetails = {};
let selectedSize = null;
let selectedColor = null;

// --- Referencias del DOM (se buscan cuando exista el DOM) ---
let featuredContainer = null;
let offersGrid = null;
let allFilteredContainer = null;
let featuredSection = null;
let offersSection = null;
let filteredSection = null;
let noProductsMessage = null;
let searchInput = null;
let searchResultsTitle = null;
let categoryCarousel = null;
let collageGrid = null;

let productModal = null;
let modalProductName = null;
let modalProductDescription = null;
let modalProductPrice = null;
let modalAddToCartBtn = null;
let qtyInput = null;
let carouselImagesContainer = null;
let prevBtn = null;
let nextBtn = null;
let cartBtn = null;
let cartBadge = null;
let cartModal = null;
let cartItemsContainer = null;
let cartTotalElement = null;
let checkoutBtn = null;
let checkoutModal = null;
let customerNameInput = null;
let customerAddressInput = null;
let finalizeBtn = null;
let installBanner = null;
let installCloseBtn = null;
let installPromptBtn = null;
let orderSuccessModal = null;
let orderSuccessTotal = null;
let whatsappBtn = null;
let closeSuccessBtn = null;
let termsConsentCheckbox = null;

let sizeOptionsContainer = null;
let colorOptionsContainer = null;

// --- Utilidades ---
const money = (v) => {
    const value = Math.floor(v || 0);
    return value.toLocaleString('es-CO');
};

const shuffleArray = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
};

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function parseOptionsField(field) {
    if (!field) return [];
    if (Array.isArray(field)) return field;
    if (typeof field === 'string') {
        if (field.includes(',')) return field.split(',').map(s => s.trim()).filter(Boolean);
        if (field.includes('|')) return field.split('|').map(s => s.trim()).filter(Boolean);
        if (field.includes(';')) return field.split(';').map(s => s.trim()).filter(Boolean);
        return [field.trim()];
    }
    return [];
}

/* --------------------------
   Render / UI helpers
   -------------------------- */
function generateProductCard(p) {
    let bestSellerTag = '';
    if (p.bestSeller) bestSellerTag = `<div class="best-seller-tag">Lo más vendido</div>`;
    let stockOverlay = '';
    let stockClass = '';
    if (!p.stock || p.stock <= 0) {
        stockOverlay = `<div class="out-of-stock-overlay">Agotado</div>`;
        stockClass = ' out-of-stock';
    }
    const imgSrc = (p.image && p.image[0]) ? p.image[0] : 'img/favicon.png';
    return `
      <div class="product-card${stockClass}" data-product-id="${p.id}">
        ${bestSellerTag}
        <div class="image-wrap">
          <img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(p.name)}" class="product-image modal-trigger" data-id="${p.id}" loading="lazy" />
          <div class="image-hint" aria-hidden="true">
            <i class="fas fa-hand-point-up" aria-hidden="true"></i>
            <span>Presiona para ver</span>
          </div>
        </div>
        ${stockOverlay}
        <div class="product-info">
          <div>
            <div class="product-name">${escapeHtml(p.name)}</div>
            <div class="product-description">${escapeHtml(p.description || '')}</div>
          </div>
          <div style="margin-top:8px">
            <div class="product-price">$${money(p.price)}</div>
          </div>
        </div>
      </div>
    `;
}

function renderProducts(container, data, page = 1, perPage = 20, withPagination = false) {
    container.innerHTML = '';
    const paginationContainer = document.getElementById('pagination-container');
    if (!data || data.length === 0) {
        if (noProductsMessage) noProductsMessage.style.display = 'block';
        if (paginationContainer) paginationContainer.innerHTML = '';
        return;
    }
    if (noProductsMessage) noProductsMessage.style.display = 'none';
    const totalPages = Math.ceil(data.length / perPage);
    const start = (page - 1) * perPage;
    const end = start + perPage;
    const currentProducts = data.slice(start, end);
    currentProducts.forEach(p => container.innerHTML += generateProductCard(p));
    if (withPagination && totalPages > 1) renderPagination(page, totalPages, data, perPage);
    else if (paginationContainer) paginationContainer.innerHTML = '';

    try { showImageHints(container); } catch (e) {}
}

function showImageHints(container) {
    const hints = container.querySelectorAll('.image-hint');
    const max = Math.min(6, hints.length);
    for (let i = 0; i < max; i++) {
        const h = hints[i];
        h.classList.add('show-hint');
        h.style.transitionDelay = `${i * 120}ms`;
    }
    setTimeout(() => {
        for (let i = 0; i < max; i++) {
            const h = hints[i];
            if (h) { h.classList.remove('show-hint'); h.style.transitionDelay = ''; }
        }
    }, 2200);
}

/* Pagination helper (igual que antes) */
function renderPagination(currentPage, totalPages, data, perPage) {
    const paginationContainer = document.getElementById('pagination-container');
    if (!paginationContainer) return;
    paginationContainer.innerHTML = '';

    function createBtn(label, page, active = false) {
        const btn = document.createElement('button');
        btn.textContent = label;
        btn.className = 'pagination-btn';
        if (active) btn.classList.add('active');
        btn.addEventListener('click', () => {
            renderProducts(allFilteredContainer, data, page, perPage, true);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        return btn;
    }
    if (currentPage > 1) paginationContainer.appendChild(createBtn('Primera', 1));
    if (currentPage > 3) paginationContainer.appendChild(document.createTextNode('...'));
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, currentPage + 2);
    for (let i = start; i <= end; i++) paginationContainer.appendChild(createBtn(i, i, i === currentPage));
    if (currentPage < totalPages - 2) paginationContainer.appendChild(document.createTextNode('...'));
    if (currentPage < totalPages) paginationContainer.appendChild(createBtn('Última', totalPages));
}

/* Category carousel generation */
function generateCategoryCarousel() {
    if (!categoryCarousel) return;
    categoryCarousel.innerHTML = '';
    const categories = Array.from(new Set(products.map(p => p.category))).filter(Boolean).map(c => ({ label: c }));
    const allItem = document.createElement('div');
    allItem.className = 'category-item';
    const allIconPath = 'img/icons/all.webp';
    allItem.innerHTML = `<img class="category-image" src="${allIconPath}" alt="Todo" data-category="__all"><span class="category-name">Todo</span>`;
    categoryCarousel.appendChild(allItem);
    categories.forEach(c => {
        const el = document.createElement('div');
        el.className = 'category-item';
        const fileName = `img/icons/${c.label.toLowerCase().replace(/\s+/g, '_')}.webp`;
        el.innerHTML = `<img class="category-image" src="${fileName}" alt="${c.label}" data-category="${c.label}"><span class="category-name">${c.label}</span>`;
        categoryCarousel.appendChild(el);
    });
}

/* Collage: no repetir imágenes y ajustar celdas para cuadrado responsivo */
function renderCollage() {
    if (!collageGrid) return;
    collageGrid.innerHTML = '';

    const pool = products
        .filter(p => p.image && p.image.length > 0)
        .map(p => ({ id: p.id, img: p.image[0] }));

    if (pool.length === 0) return;

    // calcular columnas segun ancho del contenedor
    const containerWidth = collageGrid.clientWidth || collageGrid.offsetWidth || window.innerWidth;
    let columns = 4;
    if (containerWidth < 480) columns = 2;
    else if (containerWidth < 900) columns = 3;
    else columns = 4;

    collageGrid.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
    const colWidth = Math.floor(containerWidth / columns);
    collageGrid.style.gridAutoRows = `${colWidth}px`;

    const shuffled = shuffleArray(pool.slice());
    const defaultTotalCells = 16;
    const totalCells = Math.min(defaultTotalCells, shuffled.length);

    for (let idx = 0; idx < totalCells; idx++) {
        const p = shuffled[idx];
        const item = document.createElement('div');
        item.className = 'collage-item';
        item.setAttribute('data-product-id', p.id);
        const colSpan = Math.random() > 0.8 ? 2 : 1;
        const rowSpan = Math.random() > 0.8 ? 2 : 1;
        item.style.gridColumn = `span ${Math.min(colSpan, columns)}`;
        item.style.gridRow = `span ${Math.min(rowSpan, 2)}`;
        item.innerHTML = `<img src="${escapeHtml(p.img)}" loading="lazy" alt="collage">`;
        item.addEventListener('click', () => {
            item.classList.add('collage-item-selected');
            setTimeout(() => item.classList.remove('collage-item-selected'), 260);
            const id = item.getAttribute('data-product-id');
            if (id) openProductModal(id);
        });
        collageGrid.appendChild(item);
    }
}

/* --- Touch hints for product cards --- */
function enableTouchHints() {
  let lastTouchedCard = null;
  let lastTouchMoved = false;

  function onTouchStart(e) {
    lastTouchMoved = false;
    const card = e.target.closest('.product-card');
    if (!card) return;
    if (e.target.closest('button, a, input, textarea, select')) return;
    const hint = card.querySelector('.image-hint');
    if (!hint) return;
    hint.classList.add('show-hint');
    if (card._hintTimeout) { clearTimeout(card._hintTimeout); card._hintTimeout = null; }
    card._hintTimeout = setTimeout(() => {
      hint.classList.remove('show-hint');
      card._hintTimeout = null;
    }, 2200);
    lastTouchedCard = card;
  }

  function onTouchMove() {
    lastTouchMoved = true;
    if (lastTouchedCard) {
      const h = lastTouchedCard.querySelector('.image-hint');
      if (h) h.classList.remove('show-hint');
      if (lastTouchedCard._hintTimeout) { clearTimeout(lastTouchedCard._hintTimeout); lastTouchedCard._hintTimeout = null; }
      lastTouchedCard = null;
    }
  }

  function onTouchEnd() {
    if (!lastTouchedCard) return;
    const h = lastTouchedCard.querySelector('.image-hint');
    if (h && !lastTouchMoved) {
      setTimeout(() => { h.classList.remove('show-hint'); }, 700);
    } else { if (h) h.classList.remove('show-hint'); }
    if (lastTouchedCard && lastTouchedCard._hintTimeout) { clearTimeout(lastTouchedCard._hintTimeout); lastTouchedCard._hintTimeout = null; }
    lastTouchedCard = null;
  }

  document.addEventListener('touchstart', onTouchStart, { passive: true });
  document.addEventListener('touchmove', onTouchMove, { passive: true });
  document.addEventListener('touchend', onTouchEnd, { passive: true });
}
enableTouchHints();

/* --------------------------
   Event Delegation (modals, add to cart)
   -------------------------- */
document.addEventListener('click', (e) => {
    if (e.target.closest('.modal-trigger')) {
        const id = e.target.dataset.id;
        openProductModal(id);
    }
    if (e.target.id === 'modal-add-to-cart-btn') {
        const qty = Math.max(1, parseInt(qtyInput.value) || 1);
        if (!selectedSize || !selectedColor) {
            if (!selectedSize) document.getElementById('size-group')?.classList.add('required-pulse');
            if (!selectedColor) document.getElementById('color-group')?.classList.add('required-pulse');
            setTimeout(() => {
                document.getElementById('size-group')?.classList.remove('required-pulse');
                document.getElementById('color-group')?.classList.remove('required-pulse');
            }, 1500);
            alert('Debes seleccionar talla y color antes de añadir al carrito.');
            return;
        }
        addToCart(currentProduct.id, qty, selectedSize, selectedColor);
        closeModal(productModal);
    }
});

/* Modal open/close helpers */
function showModal(modal) { if (!modal) return; modal.style.display = 'flex'; modal.setAttribute('aria-hidden', 'false'); }
function closeModal(modal) {
    if (!modal) return;
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    selectedSize = null; selectedColor = null;
    if (sizeOptionsContainer) sizeOptionsContainer.innerHTML = '';
    if (colorOptionsContainer) colorOptionsContainer.innerHTML = '';
    if (modalAddToCartBtn) { modalAddToCartBtn.disabled = true; modalAddToCartBtn.setAttribute('aria-disabled', 'true'); }
}

/* Setup modal close on overlay / close btn */
function setupModalCloseHandlers() {
    [productModal, cartModal, checkoutModal, orderSuccessModal].forEach(modal => {
        if (!modal) return;
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal(modal);
            if (e.target.classList.contains('modal-close')) closeModal(modal);
        });
    });
}

/* Render options in product modal */
function renderSizeOptions(product) {
    if (!sizeOptionsContainer) return;
    sizeOptionsContainer.innerHTML = '';
    const raw = product.sizes || product.size || product.size_options || [];
    const sizes = parseOptionsField(raw);
    const finalSizes = sizes.length ? sizes : ['S','M','L','XL'];
    finalSizes.forEach(sz => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'selection-option';
        btn.textContent = sz;
        btn.addEventListener('click', () => {
            selectedSize = sz;
            sizeOptionsContainer.querySelectorAll('.selection-option').forEach(x => x.classList.remove('selected'));
            btn.classList.add('selected');
            document.getElementById('size-group')?.classList.remove('required-pulse');
            updateAddToCartEnabled();
        });
        sizeOptionsContainer.appendChild(btn);
    });
}

function renderColorOptions(product) {
    if (!colorOptionsContainer) return;
    colorOptionsContainer.innerHTML = '';
    const raw = product.colors || product.color || product.color_options || [];
    const colors = parseOptionsField(raw);
    const finalColors = colors.length ? colors : ['Negro','Blanco','Azul'];
    finalColors.forEach(c => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'selection-option';
        const isHex = /^#([0-9A-F]{3}){1,2}$/i.test(c);
        if (isHex) {
            btn.innerHTML = `<span style="display:inline-block;width:18px;height:18px;border-radius:4px;background:${c};vertical-align:middle;"></span>`;
            btn.title = c;
        } else { btn.textContent = c; }
        btn.addEventListener('click', () => {
            selectedColor = c;
            colorOptionsContainer.querySelectorAll('.selection-option').forEach(x => x.classList.remove('selected'));
            btn.classList.add('selected');
            document.getElementById('color-group')?.classList.remove('required-pulse');
            updateAddToCartEnabled();
        });
        colorOptionsContainer.appendChild(btn);
    });
}

function updateAddToCartEnabled() {
    if (!modalAddToCartBtn) return;
    if (selectedSize && selectedColor) {
        modalAddToCartBtn.disabled = false;
        modalAddToCartBtn.setAttribute('aria-disabled', 'false');
    } else {
        modalAddToCartBtn.disabled = true;
        modalAddToCartBtn.setAttribute('aria-disabled', 'true');
    }
}

/* Product modal open */
function openProductModal(id) {
    const product = products.find(p => String(p.id) === String(id));
    if (!product) return;
    currentProduct = product;
    modalProductName.textContent = product.name;
    modalProductDescription.textContent = product.description || '';
    modalProductPrice.textContent = `$${money(product.price)}`;
    qtyInput.value = 1;
    selectedSize = null; selectedColor = null;
    renderSizeOptions(product);
    renderColorOptions(product);
    if (modalAddToCartBtn) modalAddToCartBtn.dataset.id = product.id;
    document.getElementById('size-group')?.classList.add('required-pulse');
    document.getElementById('color-group')?.classList.add('required-pulse');
    setTimeout(() => { document.getElementById('size-group')?.classList.remove('required-pulse'); document.getElementById('color-group')?.classList.remove('required-pulse'); }, 1400);
    updateCarousel(product.image || []);
    showModal(productModal);
}

/* Carousel images for product modal */
function updateCarousel(images) {
    if (!carouselImagesContainer) return;
    carouselImagesContainer.innerHTML = '';
    if (!images || images.length === 0) {
        carouselImagesContainer.innerHTML = `<div class="carousel-image" style="display:flex;align-items:center;justify-content:center;background:#f3f3f3">Sin imagen</div>`;
        return;
    }
    images.forEach(src => {
        const img = document.createElement('img');
        img.src = src;
        img.className = 'carousel-image';
        carouselImagesContainer.appendChild(img);
    });
    currentImageIndex = 0;
    carouselImagesContainer.style.transform = `translateX(0)`;
}

function updateCarouselPosition() {
    const imgs = carouselImagesContainer?.querySelectorAll('.carousel-image') || [];
    if (imgs.length === 0) return;
    const imgWidth = imgs[0].clientWidth || carouselImagesContainer.clientWidth;
    carouselImagesContainer.style.transform = `translateX(-${currentImageIndex * imgWidth}px)`;
}

/* Cart helpers (iguales a los tuyos) */
function updateCart() {
    if (!cartItemsContainer || !cartBadge || !cartTotalElement) return;
    cartItemsContainer.innerHTML = '';
    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<p class="empty-cart-msg">Tu carrito está vacío.</p>';
        cartBadge.style.display = 'none';
        cartBadge.textContent = '0';
        cartTotalElement.textContent = money(0);
        return;
    }
    let total = 0, totalItems = 0;
    cart.forEach((item, idx) => {
        total += item.price * item.qty;
        totalItems += item.qty;
        const div = document.createElement('div');
        div.className = 'cart-item';
        const itemInfo = `<div style="display:flex;align-items:center;gap:8px;">
            <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" style="width:40px;height:40px;object-fit:cover;border-radius:6px;">
            <div>
              <div style="font-weight:700">${escapeHtml(item.name)}</div>
              <div style="font-size:0.85rem;color:#666">Talla: ${escapeHtml(item.size)} • Color: ${escapeHtml(item.color)}</div>
              <div style="font-size:0.9rem;color:#333">$${money(item.price)} x ${item.qty}</div>
            </div>
          </div>`;
        const controls = `<div class="controls">
            <button class="qty-btn" data-idx="${idx}" data-op="dec">-</button>
            <span>${item.qty}</span>
            <button class="qty-btn" data-idx="${idx}" data-op="inc">+</button>
          </div>`;
        div.innerHTML = itemInfo + controls;
        cartItemsContainer.appendChild(div);
    });
    cartBadge.style.display = 'flex';
    cartBadge.textContent = String(totalItems);
    cartTotalElement.textContent = money(total);
}

function addToCart(id, qty = 1, size = null, color = null) {
    const p = products.find(x => String(x.id) === String(id));
    if (!p) return;
    const availableStock = p.stock || 0;
    const existingInCart = cart.find(i => String(i.id) === String(id) && i.size === size && i.color === color);
    const currentQtyInCart = existingInCart ? existingInCart.qty : 0;
    if (currentQtyInCart + qty > availableStock) {
        alert(`En el momento solo quedan ${availableStock} unidades.`);
        return;
    }
    if (existingInCart) existingInCart.qty += qty;
    else cart.push({ id: p.id, name: p.name, price: p.price, qty, image: (p.image && p.image[0]) ? p.image[0] : 'img/favicon.png', size, color });
    updateCart();
    showAddToCartToast({ image: (p.image && p.image[0]) ? p.image[0] : 'img/favicon.png', name: p.name, qty, size, color });
}

/* Small toast helper */
function showAddToCartToast({ image, name, qty = 1, size = '', color = '' }) {
    const existing = document.getElementById('add-to-cart-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.id = 'add-to-cart-toast';
    toast.className = 'add-to-cart-toast';
    toast.innerHTML = `
      <img src="${escapeHtml(image)}" alt="${escapeHtml(name)}" class="toast-img" loading="lazy" />
      <div class="toast-text">
        <div class="toast-title">${escapeHtml(name)}</div>
        <div class="toast-sub">Añadido x${qty} • ${escapeHtml(size)} • ${escapeHtml(color)}</div>
      </div>
    `;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    const VISIBLE_MS = 2000;
    setTimeout(() => {
        toast.classList.remove('show');
        toast.classList.add('hide');
        toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    }, VISIBLE_MS);
}

/* Cart controls (delegated) */
document.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-idx]');
    if (!btn) return;
    const idx = parseInt(btn.dataset.idx, 10);
    const op = btn.dataset.op;
    const productInCart = cart[idx];
    const originalProduct = products.find(p => String(p.id) === String(productInCart.id));
    if (op === 'inc') {
        if ((productInCart.qty + 1) > (originalProduct.stock || 0)) {
            alert(`En el momento solo quedan ${originalProduct.stock} unidades.`);
            return;
        }
        productInCart.qty++;
    } else if (op === 'dec') {
        productInCart.qty--;
        if (productInCart.qty <= 0) cart.splice(idx, 1);
    }
    updateCart();
});

/* --------------------------
   DB / Supabase helpers
   -------------------------- */
async function fetchProductsFromSupabase() {
    if (!supabaseClient) return [];
    try {
        const { data, error } = await supabaseClient.from('products').select('*');
        if (error) throw error;
        return data || [];
    } catch (err) {
        console.error('Error al cargar productos desde Supabase:', err);
        alert('Error al cargar productos. Revisa consola.');
        return [];
    }
}

/* Intento robusto de cargar configuración desde /api/get-config, con fallback */
async function loadConfigAndInitSupabase() {
    // Obtener referencias DOM (ahora que DOMContentLoaded)
    featuredContainer = document.getElementById('featured-grid');
    offersGrid = document.getElementById('offers-grid');
    allFilteredContainer = document.getElementById('all-filtered-products');
    featuredSection = document.getElementById('featured-section');
    offersSection = document.getElementById('offers-section');
    filteredSection = document.getElementById('filtered-section');
    noProductsMessage = document.getElementById('no-products-message');
    searchInput = document.getElementById('search-input');
    searchResultsTitle = document.getElementById('search-results-title');
    categoryCarousel = document.getElementById('category-carousel');
    collageGrid = document.getElementById('collage-grid');

    productModal = document.getElementById('productModal');
    modalProductName = document.getElementById('modal-product-name');
    modalProductDescription = document.getElementById('modal-product-description');
    modalProductPrice = document.getElementById('modal-product-price');
    modalAddToCartBtn = document.getElementById('modal-add-to-cart-btn');
    qtyInput = document.getElementById('qty-input');
    carouselImagesContainer = document.getElementById('carousel-images-container');
    prevBtn = document.getElementById('prev-btn');
    nextBtn = document.getElementById('next-btn');
    cartBtn = document.getElementById('cart-btn');
    cartBadge = document.getElementById('cart-badge');
    cartModal = document.getElementById('cartModal');
    cartItemsContainer = document.getElementById('cart-items');
    cartTotalElement = document.getElementById('cart-total');
    checkoutBtn = document.getElementById('checkout-btn');
    checkoutModal = document.getElementById('checkoutModal');
    customerNameInput = document.getElementById('customer-name');
    customerAddressInput = document.getElementById('customer-address');
    finalizeBtn = document.getElementById('finalize-btn');
    installBanner = document.getElementById('install-banner');
    installCloseBtn = document.getElementById('install-close-btn');
    installPromptBtn = document.getElementById('install-prompt-btn');
    orderSuccessModal = document.getElementById('orderSuccessModal');
    orderSuccessTotal = document.getElementById('order-success-total');
    whatsappBtn = document.getElementById('whatsapp-btn');
    closeSuccessBtn = document.getElementById('close-success-btn');
    termsConsentCheckbox = document.getElementById('terms-consent-checkbox');
    sizeOptionsContainer = document.getElementById('size-options');
    colorOptionsContainer = document.getElementById('color-options');

    setupModalCloseHandlers();

    // Intentar obtener config desde API route
    let config = null;
    try {
        const response = await fetch('api/get-config');
        if (response.ok) {
            config = await response.json();
        } else {
            console.warn('api/get-config respondió con status', response.status);
        }
    } catch (err) {
        console.warn('No fue posible llegar a api/get-config:', err.message || err);
    }

    // Fallback a window.APP_CONFIG (útil en desarrollo local)
    if (!config && window.APP_CONFIG) {
        config = window.APP_CONFIG;
        console.info('Usando configuración desde window.APP_CONFIG (fallback).');
    }

    if (!config || !config.url || !config.anonKey) {
        const msg = [
            'No se encontró configuración de Supabase (api/get-config falló y no existe window.APP_CONFIG).',
            'Opciones:',
            '1) Si usas Vercel / API route: asegúrate de que /api/get-config existe y devuelve { url, anonKey }.',
            '2) Para desarrollo local: crea un archivo public/js/config.js con: window.APP_CONFIG = { url: "...", anonKey: "..." }; y enlázalo antes de js/app.js.',
            '3) Verifica que en index.html se cargue el script de supabase-js antes de este app.js.'
        ].join('\n');
        console.error(msg);
        // Mostrar mensaje visible al usuario
        const loadingMessage = document.createElement('div');
        loadingMessage.style = 'position:fixed;top:0;left:0;width:100%;height:100%;background:white;display:flex;align-items:center;justify-content:center;color:red;font-weight:bold;text-align:center;padding:1rem;z-index:9999';
        loadingMessage.textContent = 'ERROR: No se encontró configuración de Supabase. Revisa consola o añade window.APP_CONFIG.';
        document.body.appendChild(loadingMessage);
        return;
    }

    SB_URL = config.url;
    SB_ANON_KEY = config.anonKey;

    // Obtener createClient de forma segura
    createClientFunc = window.supabase && window.supabase.createClient ? window.supabase.createClient : null;
    if (!createClientFunc) {
        console.error('window.supabase.createClient no está disponible. Asegúrate de cargar @supabase/supabase-js antes de app.js.');
        alert('Error: Supabase JS no cargado. Verifica que el CDN de supabase está incluido antes de este script.');
        return;
    }

    try {
        supabaseClient = createClientFunc(SB_URL, SB_ANON_KEY);

        // Obtener productos y renderizar
        products = await fetchProductsFromSupabase();
        if (Array.isArray(products) && products.length > 0) {
            showDefaultSections();
            generateCategoryCarousel();
        } else {
            // aun si no hay productos queremos renderCollage (quizá vacío)
            renderCollage();
        }
        updateCart();

        // listeners adicionales (prev/next carousel)
        if (prevBtn) prevBtn.addEventListener('click', () => {
            if (currentImageIndex > 0) currentImageIndex--;
            updateCarouselPosition();
        });
        if (nextBtn) nextBtn.addEventListener('click', () => {
            const imgs = carouselImagesContainer?.querySelectorAll('.carousel-image') || [];
            if (currentImageIndex < imgs.length - 1) currentImageIndex++;
            updateCarouselPosition();
        });

        // Category carousel drag: CORRECCIÓN de variable en touchmove
        if (categoryCarousel) {
            (function makeCarouselDraggable() {
                let isDown = false, startX, scrollLeft;
                categoryCarousel.addEventListener('mousedown', (e) => {
                    isDown = true; startX = e.pageX - categoryCarousel.offsetLeft; scrollLeft = categoryCarousel.scrollLeft;
                });
                window.addEventListener('mouseup', () => { isDown = false; });
                categoryCarousel.addEventListener('mousemove', (e) => {
                    if (!isDown) return;
                    e.preventDefault();
                    const x = e.pageX - categoryCarousel.offsetLeft;
                    const walk = (x - startX) * 1.5;
                    categoryCarousel.scrollLeft = scrollLeft - walk;
                });
                categoryCarousel.addEventListener('touchstart', (e) => {
                    startX = e.touches[0].pageX - categoryCarousel.offsetLeft;
                    scrollLeft = categoryCarousel.scrollLeft;
                });
                categoryCarousel.addEventListener('touchmove', (e) => {
                    // FIX: usar categoryCarousel (no category.carousel)
                    const x = e.touches[0].pageX - categoryCarousel.offsetLeft;
                    const walk = (x - startX) * 1.2;
                    categoryCarousel.scrollLeft = scrollLeft - walk;
                });
            })();
        }

        // listeners de UI (básicos)
        if (searchInput) searchInput.addEventListener('input', (e) => {
            const q = e.target.value.trim().toLowerCase();
            if (!q) { showDefaultSections(); return; }
            const filtered = products.filter(p => (p.name || '').toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q));
            filteredSection.style.display = 'block';
            featuredSection.style.display = 'none';
            offersSection.style.display = 'none';
            searchResultsTitle.textContent = `Resultados para "${q}"`;
            renderProducts(allFilteredContainer, filtered, 1, 20, true);
        });

        // instalar antesinstallprompt
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault(); deferredPrompt = e;
            if (installBanner) installBanner.classList.add('visible');
        });
        installPromptBtn && installPromptBtn.addEventListener('click', async () => {
            if (!deferredPrompt) return;
            installBanner.classList.remove('visible');
            deferredPrompt.prompt();
            await deferredPrompt.userChoice;
            deferredPrompt = null;
        });
        installCloseBtn && installCloseBtn.addEventListener('click', () => installBanner.classList.remove('visible'));

    } catch (err) {
        console.error('Error inicializando Supabase o cargando datos:', err);
        alert('Error inicializando la app. Revisa la consola para más detalles.');
    }
}

/* Mostrar secciones por defecto */
const showDefaultSections = () => {
    if (featuredSection) featuredSection.style.display = 'block';
    if (offersSection) offersSection.style.display = 'block';
    if (filteredSection) filteredSection.style.display = 'none';
    const featured = shuffleArray((products || []).filter(p => p.featured)).slice(0, 25);
    const offers = shuffleArray((products || []).filter(p => p.isOffer)).slice(0, 25);
    if (featuredContainer) renderProducts(featuredContainer, featured, 1, 25, false);
    if (offersGrid) renderProducts(offersGrid, offers, 1, 25, false);
    renderCollage();
};

/* --------------------------
   Inicialización en DOMContentLoaded
   -------------------------- */
document.addEventListener('DOMContentLoaded', () => {
    // Llamada principal
    loadConfigAndInitSupabase().catch(err => {
        console.error('Error en loadConfigAndInitSupabase:', err);
    });
});

/* Exponer funciones utiles en window (si las necesitas) */
window.openProductModal = openProductModal;
window.addToCart = addToCart;
window.fetchProductsFromSupabase = fetchProductsFromSupabase;