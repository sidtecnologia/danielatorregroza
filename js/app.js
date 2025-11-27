

const { createClient } = supabase;

let SB_URL = null;
let SB_ANON_KEY = null;
let supabaseClient = null;

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

// --- Referencias del DOM (guardadas con comprobación) ---
const featuredContainer = document.getElementById('featured-grid');
const offersGrid = document.getElementById('offers-grid');
const allFilteredContainer = document.getElementById('all-filtered-products');
const featuredSection = document.getElementById('featured-section');
const offersSection = document.getElementById('offers-section');
const filteredSection = document.getElementById('filtered-section');
const noProductsMessage = document.getElementById('no-products-message');
const searchInput = document.getElementById('search-input');
const searchResultsTitle = document.getElementById('search-results-title');
const categoryCarousel = document.getElementById('category-carousel');
const collageGrid = document.getElementById('collage-grid');

const productModal = document.getElementById('productModal');
const modalProductName = document.getElementById('modal-product-name');
const modalProductDescription = document.getElementById('modal-product-description');
const modalProductPrice = document.getElementById('modal-product-price');
const modalAddToCartBtn = document.getElementById('modal-add-to-cart-btn');
const qtyInput = document.getElementById('qty-input');
const carouselImagesContainer = document.getElementById('carousel-images-container');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');

const cartBtn = document.getElementById('cart-btn');
const cartBadge = document.getElementById('cart-badge');
const cartModal = document.getElementById('cartModal');
const cartItemsContainer = document.getElementById('cart-items');
const cartTotalElement = document.getElementById('cart-total');
const checkoutBtn = document.getElementById('checkout-btn');
const checkoutModal = document.getElementById('checkoutModal');
const customerNameInput = document.getElementById('customer-name');
const customerAddressInput = document.getElementById('customer-address');
const finalizeBtn = document.getElementById('finalize-btn');
const installBanner = document.getElementById('install-banner');
const installCloseBtn = document.getElementById('install-close-btn');
const installPromptBtn = document.getElementById('install-prompt-btn');
const orderSuccessModal = document.getElementById('orderSuccessModal');
const orderSuccessTotal = document.getElementById('order-success-total');
const whatsappBtn = document.getElementById('whatsapp-btn');
const closeSuccessBtn = document.getElementById('close-success-btn');
const termsConsentCheckbox = document.getElementById('terms-consent-checkbox');

const sizeOptionsContainer = document.getElementById('size-options');
const colorOptionsContainer = document.getElementById('color-options');

const bannerCarousel = document.getElementById('banner-carousel');
const bannerDots = document.getElementById('banner-dots');

// Optional/new elements (guarded)
const logoElement = document.querySelector('.brand-logo');
const storeModal = document.getElementById('storeModal');
const storeModalContent = document.getElementById('store-modal-content');
const imageViewerModal = document.getElementById('imageViewerModal');
const viewerImage = document.getElementById('viewer-image');
const viewerPrev = document.getElementById('viewer-prev');
const viewerNext = document.getElementById('viewer-next');
const viewerClose = document.getElementById('viewer-close');

let bannerCarouselState = null;

// --- Helpers ---
const money = (v) => {
    const value = Math.floor(v);
    return value.toLocaleString('es-CO');
};

const shuffleArray = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
};

/* Safe DOM helpers */
const on = (el, ev, fn) => { if (el) el.addEventListener(ev, fn); };

/* Banner: init from bucket - kept minimal and robust */
async function fetchBannerImagesFromSupabase() {
    if (!supabaseClient) return [];
    try {
        const { data: files, error } = await supabaseClient.storage.from('images').list('baner', { limit: 200, offset: 0 });
        if (error) {
            console.warn('Error listing banner files:', error);
            return [];
        }
        if (!files || files.length === 0) return [];
        const sorted = files.slice().sort((a, b) => a.name.localeCompare(b.name));
        const urls = sorted.map(f => {
            const { data } = supabaseClient.storage.from('images').getPublicUrl(`baner/${f.name}`);
            return data?.publicUrl || '';
        }).filter(Boolean);
        return urls;
    } catch (err) {
        console.error('fetchBannerImagesFromSupabase err', err);
        return [];
    }
}

function initBannerCarousel(images = []) {
    if (!bannerCarousel) return;
    bannerCarousel.innerHTML = '';
    if (!images || images.length === 0) {
        bannerCarousel.innerHTML = `<div class="banner-slide"><img src="img/favicon.png" alt="Promoción"></div>`;
        return;
    }
    images.forEach(src => {
        const slide = document.createElement('div');
        slide.className = 'banner-slide';
        slide.innerHTML = `<img src="${src}" alt="Promoción">`;
        bannerCarousel.appendChild(slide);
    });

    if (bannerDots) bannerDots.innerHTML = '';
    const slides = bannerCarousel.querySelectorAll('.banner-slide');
    slides.forEach((_, idx) => {
        if (!bannerDots) return;
        const dot = document.createElement('div');
        dot.classList.add('banner-dot');
        if (idx === 0) dot.classList.add('active');
        dot.addEventListener('click', () => {
            if (!bannerCarouselState) return;
            bannerCarouselState.goTo(idx);
        });
        bannerDots.appendChild(dot);
    });

    if (bannerCarouselState && bannerCarouselState.destroy) bannerCarouselState.destroy();
    bannerCarouselState = createBannerState(bannerCarousel, bannerCarousel.querySelectorAll('.banner-slide'), bannerDots);
    bannerCarouselState.start();
}
function createBannerState(container, slidesNodeList, dotsContainer) {
    let slides = Array.from(container.querySelectorAll('.banner-slide'));
    if (slides.length === 0) return { start: () => {}, goTo: () => {}, destroy: () => {} };
    const firstClone = slides[0].cloneNode(true);
    const lastClone = slides[slides.length - 1].cloneNode(true);
    container.appendChild(firstClone);
    container.insertBefore(lastClone, slides[0]);
    slides = Array.from(container.querySelectorAll('.banner-slide'));
    let current = 1;
    container.style.transform = `translateX(-${current * 100}%)`;
    container.style.transition = 'transform 0.5s ease';
    let intervalId = null;
    const dots = dotsContainer ? Array.from(dotsContainer.querySelectorAll('.banner-dot')) : [];

    function update() {
        container.style.transform = `translateX(-${current * 100}%)`;
        if (dots.length) {
            const dotIndex = (current - 1 + dots.length) % dots.length;
            dots.forEach((d, i) => d.classList.toggle('active', i === dotIndex));
        }
    }

    function next() {
        current++;
        update();
        if (current >= slides.length - 1) {
            setTimeout(() => {
                container.style.transition = 'none';
                current = 1;
                container.style.transform = `translateX(-${current * 100}%)`;
                setTimeout(() => container.style.transition = 'transform 0.5s ease', 50);
            }, 500);
        }
    }

    function goTo(idx) {
        current = idx + 1;
        update();
        resetInterval();
    }

    function resetInterval() {
        clearInterval(intervalId);
        intervalId = setInterval(next, 4000);
    }

    let startX = 0;
    container.addEventListener('touchstart', e => startX = e.touches[0].clientX, { passive: true });
    container.addEventListener('touchend', e => {
        const endX = e.changedTouches[0].clientX;
        if (endX - startX > 50) { current = Math.max(1, current - 1); update(); }
        else if (startX - endX > 50) { next(); }
        resetInterval();
    }, { passive: true });

    let isDown = false, startXMouse;
    container.addEventListener('mousedown', e => { isDown = true; startXMouse = e.pageX; });
    container.addEventListener('mouseup', e => {
        if (!isDown) return;
        const diff = e.pageX - startXMouse;
        if (diff > 50) { current = Math.max(1, current - 1); update(); }
        else if (diff < -50) { next(); }
        isDown = false;
        resetInterval();
    });

    return { start: () => resetInterval(), goTo, destroy: () => clearInterval(intervalId) };
}

// --- Product card generation (kept) ---
const generateProductCard = (p) => {
    let bestSellerTag = p.bestSeller ? `<div class="best-seller-tag">Lo más vendido</div>` : '';

    let stockOverlay = '';
    let stockClass = '';
    if (!p.stock || p.stock <= 0) {
        stockOverlay = `<div class="out-of-stock-overlay">Agotado</div>`;
        stockClass = ' out-of-stock';
    }

    const offerClass = p._offerStyle ? ` ${p._offerStyle}` : '';

    return `
      <div class="product-card${stockClass}${offerClass}" data-product-id="${p.id}">
        ${bestSellerTag}
        <div class="image-wrap">
          <img src="${p.image && p.image[0] ? p.image[0] : 'img/favicon.png'}" alt="${p.name}" class="product-image modal-trigger" data-id="${p.id}" loading="lazy" />
          <div class="image-hint" aria-hidden="true">
            <i class="fas fa-hand-point-up" aria-hidden="true"></i>
            <span>Presiona para ver</span>
          </div>
        </div>
        ${stockOverlay}
        <div class="product-info">
          <div>
            <div class="product-name">${p.name}</div>
            <div class="product-description">${p.description || ''}</div>
          </div>
          <div style="margin-top:8px">
            <div class="product-price">$${money(p.price)}</div>
          </div>
        </div>
      </div>
    `;
};

function renderProducts(container, data, page = 1, perPage = 20, withPagination = false) {
    if (!container) return;
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
    if (withPagination && totalPages > 1) {
        renderPagination(page, totalPages, data, perPage);
    } else {
        if (paginationContainer) paginationContainer.innerHTML = '';
    }
    try { showImageHints(container); } catch (e) {}
}

function showImageHints(container) {
    try {
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
                if (h) {
                    h.classList.remove('show-hint');
                    h.style.transitionDelay = '';
                }
            }
        }, 2200);
    } catch (err) { console.warn('showImageHints err', err); }
}

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
    card._hintTimeout = setTimeout(() => { hint.classList.remove('show-hint'); card._hintTimeout = null; }, 2200);
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
    } else {
      if (h) h.classList.remove('show-hint');
    }
    if (lastTouchedCard && lastTouchedCard._hintTimeout) { clearTimeout(lastTouchedCard._hintTimeout); lastTouchedCard._hintTimeout = null; }
    lastTouchedCard = null;
  }

  document.addEventListener('touchstart', onTouchStart, { passive: true });
  document.addEventListener('touchmove', onTouchMove, { passive: true });
  document.addEventListener('touchend', onTouchEnd, { passive: true });
}
enableTouchHints();

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

const generateCategoryCarousel = () => {
    if (!categoryCarousel) return;
    categoryCarousel.innerHTML = '';
    const categories = Array.from(new Set(products.map(p => p.category))).map(c => ({ label: c }));
    const allItem = document.createElement('div');
    allItem.className = 'category-item';
    const allIconPath = 'img/icons/all.webp';
    allItem.innerHTML = `<img class="category-image" src="${allIconPath}" alt="Todo" data-category="__all"><span class="category-name">Todo</span>`;
    categoryCarousel.appendChild(allItem);
    categories.forEach(c => {
        const el = document.createElement('div');
        el.className = 'category-item';
        const fileName = `img/icons/${(c.label || '').toLowerCase().replace(/\s+/g, '_')}.webp`;
        el.innerHTML = `<img class="category-image" src="${fileName}" alt="${c.label}" data-category="${c.label}"><span class="category-name">${c.label}</span>`;
        categoryCarousel.appendChild(el);
    });
};

/* Collage: no repite imágenes y no deja espacios.
   Usa aspect-ratio en CSS para mantener cuadrado y calcula columnas = ceil(sqrt(n)).
*/
function renderCollage() {
    if (!collageGrid) return;
    collageGrid.innerHTML = '';

    const pool = products
        .filter(p => p.image && p.image.length > 0)
        .map(p => ({ id: p.id, img: p.image[0] }));

    if (pool.length === 0) return;

    const shuffled = shuffleArray(pool.slice());
    const total = shuffled.length;
    const cols = Math.ceil(Math.sqrt(total));
    // set grid columns (CSS ensures aspect ratio / auto-rows = 1fr)
    collageGrid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    // keep square using CSS aspect-ratio in stylesheet (.collage-grid { aspect-ratio:1/1 })
    // create one item per image (no spans) so grid fills every cell
    for (let i = 0; i < total; i++) {
        const p = shuffled[i];
        const item = document.createElement('div');
        item.className = 'collage-item';
        item.setAttribute('data-product-id', p.id);
        item.style.gridColumn = 'span 1';
        item.style.gridRow = 'span 1';
        item.innerHTML = `<img src="${p.img}" loading="lazy" alt="collage">`;
        item.addEventListener('click', (ev) => {
            item.classList.add('collage-item-selected');
            setTimeout(() => item.classList.remove('collage-item-selected'), 260);
            const id = item.getAttribute('data-product-id');
            if (id) openProductModal(id);
        });
        collageGrid.appendChild(item);
    }
}

// Responsive: re-render collage on resize with debounce
let collageResizeTimeout = null;
window.addEventListener('resize', () => {
    if (collageResizeTimeout) clearTimeout(collageResizeTimeout);
    collageResizeTimeout = setTimeout(() => { if (products && products.length > 0) renderCollage(); }, 180);
});

/* Parse tallas/colores pequeño helper */
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

/* Search extended across many fields */
function productMatchesQuery(p, q) {
    if (!q) return true;
    const Q = q.toLowerCase();
    const fields = [p.name, p.description, p.category, p.brand, p.marca, p.sku, (p.tags && Array.isArray(p.tags) ? p.tags.join(' ') : p.tags)]
        .filter(Boolean).map(s => String(s).toLowerCase());
    const sizes = parseOptionsField(p.sizes || p.size || p.size_options || []);
    const colors = parseOptionsField(p.colors || p.color || p.color_options || []);
    const numeric = [p.price ? String(p.price) : ''];
    for (const f of fields) if (f.includes(Q)) return true;
    for (const s of sizes) if (String(s).toLowerCase().includes(Q)) return true;
    for (const c of colors) if (String(c).toLowerCase().includes(Q)) return true;
    for (const n of numeric) if (n.includes(Q)) return true;
    return false;
}

on(searchInput, 'input', (e) => {
    const q = e.target.value.trim();
    if (!q) { showDefaultSections(); return; }
    const filtered = products.filter(p => productMatchesQuery(p, q));
    if (filteredSection) filteredSection.style.display = 'block';
    if (featuredSection) featuredSection.style.display = 'none';
    if (offersSection) offersSection.style.display = 'none';
    if (searchResultsTitle) searchResultsTitle.textContent = `Resultados para "${q}"`;
    renderProducts(allFilteredContainer, filtered, 1, 20, true);
});

const showDefaultSections = () => {
    if (featuredSection) featuredSection.style.display = 'block';
    if (offersSection) offersSection.style.display = 'block';
    if (filteredSection) filteredSection.style.display = 'none';
    const featured = shuffleArray(products.filter(p => p.featured)).slice(0, 25);
    const offers = shuffleArray(products.filter(p => p.isOffer)).slice(0, 25).map((p, idx) => {
        const clone = Object.assign({}, p);
        clone._offerStyle = `offer-style-${(idx % 3) + 1}`;
        return clone;
    });
    renderProducts(featuredContainer, featured, 1, 25, false);
    renderProducts(offersGrid, offers, 1, 25, false);
    renderCollage();
    generateCategoryCarousel();
};

on(categoryCarousel, 'click', (ev) => {
    const img = ev.target.closest ? ev.target.closest('.category-image') : null;
    if (!img) return;
    const cat = img.dataset.category;
    if (searchInput) searchInput.value = '';
    if (cat === '__all') { showDefaultSections(); return; }
    const filtered = products.filter(p => p.category && p.category.toLowerCase() === cat.toLowerCase());
    if (filteredSection) filteredSection.style.display = 'block';
    if (featuredSection) featuredSection.style.display = 'none';
    if (offersSection) offersSection.style.display = 'none';
    if (searchResultsTitle) searchResultsTitle.textContent = cat;
    renderProducts(allFilteredContainer, filtered, 1, 20, true);
});

(function makeCarouselDraggable() {
    let isDown = false, startX, scrollLeft;
    if (!categoryCarousel) return;
    categoryCarousel.addEventListener('mousedown', (e) => {
        isDown = true;
        startX = e.pageX - categoryCarousel.offsetLeft;
        scrollLeft = categoryCarousel.scrollLeft;
    });
    window.addEventListener('mouseup', () => isDown = false);
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
        const x = e.touches[0].pageX - categoryCarousel.offsetLeft;
        const walk = (x - startX) * 1.2;
        categoryCarousel.scrollLeft = scrollLeft - walk;
    });
})();

/* Global click handlers:
   - modal-trigger opens product modal,
   - modal add-to-cart works,
   - logo opens store modal,
   - clicking carousel image opens image viewer if viewer exists.
*/
document.addEventListener('click', (e) => {
    if (e.target.closest && e.target.closest('.modal-trigger')) {
        const id = e.target.dataset.id;
        openProductModal(id);
    }
    if (e.target && e.target.id === 'modal-add-to-cart-btn') {
        const qty = Math.max(1, parseInt(qtyInput.value) || 1);
        if (!selectedSize || !selectedColor) {
            if (document.getElementById('size-group')) document.getElementById('size-group').classList.add('required-pulse');
            if (document.getElementById('color-group')) document.getElementById('color-group').classList.add('required-pulse');
            setTimeout(() => {
                if (document.getElementById('size-group')) document.getElementById('size-group').classList.remove('required-pulse');
                if (document.getElementById('color-group')) document.getElementById('color-group').classList.remove('required-pulse');
            }, 1500);
            alert('Debes seleccionar talla y color antes de añadir al carrito.');
            return;
        }
        addToCart(currentProduct.id, qty, selectedSize, selectedColor);
        closeModal(productModal);
    }

    // logo opens store modal
    if ((logoElement && (e.target === logoElement || e.target.closest('.brand')))) {
        if (logoElement) openStoreModalFromLogo();
    }

    // clicking a carousel image inside product modal should open image viewer if present
    if (carouselImagesContainer && e.target.closest && e.target.closest('.carousel-image')) {
        const imgNodes = Array.from(carouselImagesContainer.querySelectorAll('.carousel-image'));
        const clicked = e.target.closest('.carousel-image');
        const idx = imgNodes.indexOf(clicked);
        if (idx >= 0 && imageViewerModal && viewerImage && viewerPrev && viewerNext) {
            const urls = imgNodes.map(i => i.src);
            openImageViewer(urls, idx);
        }
    }
});

// --- Modales ---
// showModal / closeModal: closeModal ONLY resets selection when productModal is closed
function showModal(modal) {
    if (!modal) return;
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
}
function closeModal(modal) {
    if (!modal) return;
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    // Only clear size/color when productModal is closed explicitly
    if (modal === productModal) {
        selectedSize = null;
        selectedColor = null;
        if (sizeOptionsContainer) sizeOptionsContainer.innerHTML = '';
        if (colorOptionsContainer) colorOptionsContainer.innerHTML = '';
        if (modalAddToCartBtn) {
            modalAddToCartBtn.disabled = true;
            modalAddToCartBtn.setAttribute('aria-disabled', 'true');
        }
    }
}

// Generic modal click behavior: DO NOT close storeModal on backdrop clicks
[productModal, cartModal, checkoutModal, orderSuccessModal, storeModal, imageViewerModal].forEach(modal => {
    if (!modal) return;
    modal.addEventListener('click', (e) => {
        // click on backdrop
        if (e.target === modal) {
            if (modal === storeModal) {
                // do NOT close store modal by backdrop: require explicit close
                return;
            }
            closeModal(modal);
        }
        // close buttons with class modal-close close modal normally
        if (e.target.classList && e.target.classList.contains('modal-close')) {
            closeModal(modal);
        }
    });
});

// Store modal: open from logo with a small origin animation (if present)
function openStoreModalFromLogo() {
    if (!storeModal || !storeModalContent) return;
    try {
        const rect = logoElement.getBoundingClientRect();
        const originX = rect.left + rect.width / 2;
        const originY = rect.top + rect.height / 2;
        storeModalContent.style.transformOrigin = `${originX}px ${originY}px`;
    } catch (err) {
        // ignore if logo not measurable
    }
    storeModal.classList.add('animate-from-logo');
    showModal(storeModal);
    setTimeout(() => storeModal.classList.remove('animate-from-logo'), 700);
}

// --- Producto modal (abrir/actualizar) ---
function openProductModal(id) {
    const product = products.find(p => p.id === id);
    if (!product) return;
    currentProduct = product;
    if (modalProductName) modalProductName.textContent = product.name;
    if (modalProductDescription) modalProductDescription.textContent = product.description || '';
    if (modalProductPrice) modalProductPrice.textContent = `$${money(product.price)}`;
    if (qtyInput) qtyInput.value = 1;

    // reset selections when opening fresh
    selectedSize = null;
    selectedColor = null;

    renderSizeOptions(product);
    renderColorOptions(product);
    if (modalAddToCartBtn) modalAddToCartBtn.dataset.id = product.id;

    // tiny hint animation
    const sizeGroup = document.getElementById('size-group');
    const colorGroup = document.getElementById('color-group');
    if (sizeGroup) sizeGroup.classList.add('required-pulse');
    if (colorGroup) colorGroup.classList.add('required-pulse');
    setTimeout(() => {
        if (sizeGroup) sizeGroup.classList.remove('required-pulse');
        if (colorGroup) colorGroup.classList.remove('required-pulse');
    }, 1400);

    updateCarousel(product.image || []);
    showModal(productModal);
}

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
            const sizeGroup = document.getElementById('size-group');
            if (sizeGroup) sizeGroup.classList.remove('required-pulse');
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
        } else {
            btn.textContent = c;
        }
        btn.addEventListener('click', () => {
            selectedColor = c;
            colorOptionsContainer.querySelectorAll('.selection-option').forEach(x => x.classList.remove('selected'));
            btn.classList.add('selected');
            const colorGroup = document.getElementById('color-group');
            if (colorGroup) colorGroup.classList.remove('required-pulse');
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

// --- Carousel inside product modal ---
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
on(prevBtn, 'click', () => { if (currentImageIndex > 0) currentImageIndex--; updateCarouselPosition(); });
on(nextBtn, 'click', () => { const imgs = carouselImagesContainer ? carouselImagesContainer.querySelectorAll('.carousel-image') : []; if (currentImageIndex < imgs.length - 1) currentImageIndex++; updateCarouselPosition(); });
function updateCarouselPosition() {
    const imgs = carouselImagesContainer ? carouselImagesContainer.querySelectorAll('.carousel-image') : [];
    if (imgs.length === 0) return;
    const imgWidth = imgs[0].clientWidth || carouselImagesContainer.clientWidth;
    carouselImagesContainer.style.transform = `translateX(-${currentImageIndex * imgWidth}px)`;
}
window.addEventListener('resize', updateCarouselPosition);

// --- Image Viewer (if present) ---
// The viewer only closes itself and does NOT modify product modal selections.
function openImageViewer(images = [], startIndex = 0) {
    if (!imageViewerModal || !viewerImage) return;
    imageViewerModal.dataset.images = JSON.stringify(images);
    imageViewerModal.dataset.index = String(startIndex || 0);
    updateViewer();
    showModal(imageViewerModal);
    setTimeout(() => viewerImage.classList.add('viewer-show'), 20);
}
function updateViewer() {
    if (!imageViewerModal || !viewerImage) return;
    const images = JSON.parse(imageViewerModal.dataset.images || '[]');
    let idx = parseInt(imageViewerModal.dataset.index || '0', 10);
    if (idx < 0) idx = 0;
    if (idx >= images.length) idx = images.length - 1;
    imageViewerModal.dataset.index = String(idx);
    viewerImage.src = images[idx] || '';
    if (viewerPrev) viewerPrev.style.display = idx > 0 ? 'flex' : 'none';
    if (viewerNext) viewerNext.style.display = idx < images.length - 1 ? 'flex' : 'none';
}
if (viewerPrev) viewerPrev.addEventListener('click', (e) => { e.stopPropagation(); let idx = parseInt(imageViewerModal.dataset.index || '0', 10); if (idx > 0) idx--; imageViewerModal.dataset.index = String(idx); updateViewer(); });
if (viewerNext) viewerNext.addEventListener('click', (e) => { e.stopPropagation(); const images = JSON.parse(imageViewerModal.dataset.images || '[]'); let idx = parseInt(imageViewerModal.dataset.index || '0', 10); if (idx < images.length - 1) idx++; imageViewerModal.dataset.index = String(idx); updateViewer(); });
if (viewerClose) viewerClose.addEventListener('click', () => {
    if (viewerImage) viewerImage.classList.remove('viewer-show');
    setTimeout(() => closeModal(imageViewerModal), 200);
});
document.addEventListener('keydown', (e) => {
    if (imageViewerModal && imageViewerModal.style.display === 'flex') {
        if (e.key === 'ArrowLeft' && viewerPrev) viewerPrev.click();
        if (e.key === 'ArrowRight' && viewerNext) viewerNext.click();
        if (e.key === 'Escape' && viewerClose) viewerClose.click();
    }
});

// --- Cart/checkout logic unchanged (kept the same and robust with guards) ---
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
            <img src="${item.image}" alt="${item.name}" style="width:40px;height:40px;object-fit:cover;border-radius:6px;">
            <div>
              <div style="font-weight:700">${item.name}</div>
              <div style="font-size:0.85rem;color:#666">Talla: ${item.size} • Color: ${item.color}</div>
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
    const p = products.find(x => x.id === id);
    if (!p) return;
    const availableStock = p.stock || 0;
    const existingInCart = cart.find(i => i.id === id && i.size === size && i.color === color);
    const currentQtyInCart = existingInCart ? existingInCart.qty : 0;
    if (currentQtyInCart + qty > availableStock) {
        alert(`En el momento solo quedan ${availableStock} unidades.`);
        return;
    }
    if (existingInCart) existingInCart.qty += qty;
    else cart.push({ id: p.id, name: p.name, price: p.price, qty, image: p.image && p.image[0] ? p.image[0] : 'img/favicon.png', size, color });
    updateCart();
    showAddToCartToast({ image: p.image && p.image[0] ? p.image[0] : 'img/favicon.png', name: p.name, qty, size, color });
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function showAddToCartToast({ image, name, qty = 1, size = '', color = '' }) {
    const existing = document.getElementById('add-to-cart-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.id = 'add-to-cart-toast';
    toast.className = 'add-to-cart-toast';
    const safeName = escapeHtml(name);
    const safeSize = escapeHtml(size);
    const safeColor = escapeHtml(color);
    toast.innerHTML = `
      <img src="${image}" alt="${safeName}" class="toast-img" loading="lazy" />
      <div class="toast-text">
        <div class="toast-title">${safeName}</div>
        <div class="toast-sub">Añadido x${qty} • ${safeSize} • ${safeColor}</div>
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

on(cartItemsContainer, 'click', (e) => {
    const btn = e.target.closest ? e.target.closest('button[data-idx]') : null;
    if (!btn) return;
    const idx = parseInt(btn.dataset.idx, 10);
    const op = btn.dataset.op;
    const productInCart = cart[idx];
    const originalProduct = products.find(p => p.id === productInCart.id);
    if (op === 'inc') {
        if ((productInCart.qty + 1) > (originalProduct.stock || 0)) { alert(`En el momento solo quedan ${originalProduct.stock} unidades.`); return; }
        productInCart.qty++;
    }
    if (op === 'dec') {
        productInCart.qty--;
        if (productInCart.qty <= 0) cart.splice(idx, 1);
    }
    updateCart();
});

on(cartBtn, 'click', () => { showModal(cartModal); updateCart(); });
on(checkoutBtn, 'click', () => { if (cart.length === 0) { alert('El carrito está vacío'); return; } showModal(checkoutModal); });

on(finalizeBtn, 'click', () => {
    const name = customerNameInput.value.trim();
    const address = customerAddressInput.value.trim();
    const payment = document.querySelector('input[name="payment"]:checked')?.value || '';
    if (!termsConsentCheckbox.checked) { alert('Debes aceptar los Términos y Condiciones y la Política de Datos para continuar.'); return; }
    if (!name || !address) { alert('Por favor completa nombre y dirección'); return; }
    orderDetails = { name, address, payment, items: cart.map(item => ({ id: item.id, name: item.name, price: item.price, qty: item.qty, size: item.size, color: item.color })), total: cart.reduce((acc, item) => acc + item.price * item.qty, 0) };
    closeModal(checkoutModal);
    closeModal(cartModal);
    showOrderSuccessModal();
});

function showOrderSuccessModal() { if (orderDetails.total) orderSuccessTotal.textContent = money(orderDetails.total); showModal(orderSuccessModal); }

on(whatsappBtn, 'click', async () => {
    if (Object.keys(orderDetails).length === 0) { alert('No hay detalles del pedido para enviar.'); return; }
    if (!supabaseClient) { alert('El cliente no está inicializado. Inténtalo de nuevo.'); return; }
    try {
        const { data: orderData, error: orderError } = await supabaseClient.from('orders').insert([{
            customer_name: orderDetails.name,
            customer_address: orderDetails.address,
            payment_method: orderDetails.payment,
            total_amount: orderDetails.total,
            order_items: orderDetails.items,
            order_status: 'Pendiente'
        }]).select();
        if (orderError) { console.error('Error al guardar la orden en DB (cliente):', orderError); alert('Error al guardar la orden en DB: ' + orderError.message); return; }

        const response = await fetch('api/place-order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderDetails, products }) });
        if (!response.ok) { const errorText = await response.text(); console.error('API Route Falló con status:', response.status, 'Respuesta:', errorText); }

        const whatsappNumber = '573227671829';
        let message = `Hola mi nombre es ${encodeURIComponent(orderDetails.name)}.%0AHe realizado un pedido para la dirección ${encodeURIComponent(orderDetails.address)}.%0A%0A`;
        orderDetails.items.forEach(item => { message += `- ${encodeURIComponent(item.name)} (Talla: ${encodeURIComponent(item.size)}, Color: ${encodeURIComponent(item.color)}) x${item.qty} = $${money(item.price * item.qty)}%0A`; });
        message += `%0ATotal: $${money(orderDetails.total)}`;
        const link = `https://wa.me/${whatsappNumber}?text=${message}`;
        window.open(link, '_blank');

        cart = []; orderDetails = {};
        products = await fetchProductsFromSupabase();
        showDefaultSections(); updateCart(); closeModal(orderSuccessModal);
    } catch (error) {
        alert('Error al procesar el pedido: ' + error.message);
        console.error('Fallo en el pedido:', error);
    }
});

window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; if (installBanner) installBanner.classList.add('visible'); });
on(installPromptBtn, 'click', async () => { if (!deferredPrompt) return; installBanner.classList.remove('visible'); deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; });
on(installCloseBtn, 'click', () => { if (installBanner) installBanner.classList.remove('visible'); });

// --- DB functions ---
const fetchProductsFromSupabase = async () => {
    if (!supabaseClient) return [];
    try {
        const { data, error } = await supabaseClient.from('products').select('*');
        if (error) throw error;
        return data;
    } catch (err) {
        console.error('Error al cargar los productos:', err.message);
        alert('Hubo un error al cargar los productos. Por favor, revisa la consola para más detalles.');
        return [];
    }
};

const loadConfigAndInitSupabase = async () => {
    try {
        const response = await fetch('api/get-config');
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Error del API Route api/get-config:', errorText);
            throw new Error(`Fallo al cargar la configuración: ${response.status} ${response.statusText}`);
        }
        const config = await response.json();
        if (!config.url || !config.anonKey) throw new Error("El API Route no retornó las claves de DB. Revisa variables de entorno.");
        SB_URL = config.url; SB_ANON_KEY = config.anonKey;
        supabaseClient = createClient(SB_URL, SB_ANON_KEY);
        products = await fetchProductsFromSupabase();
        const bannerImages = await fetchBannerImagesFromSupabase();
        initBannerCarousel(bannerImages);
        if (products.length > 0) { showDefaultSections(); generateCategoryCarousel(); } else { renderCollage(); }
        updateCart();
    } catch (error) {
        console.error('Error FATAL al iniciar la aplicación:', error);
        const loadingMessage = document.createElement('div');
        loadingMessage.style = 'position:fixed;top:0;left:0;width:100%;height:100%;background:white;display:flex;align-items:center;justify-content:center;color:red;font-weight:bold;text-align:center;padding:20px;z-index:9999;';
        loadingMessage.textContent = 'ERROR DE INICIALIZACIÓN: No se pudo cargar la configuración de la tienda. Revisa la consola.';
        document.body.appendChild(loadingMessage);
    }
};

document.addEventListener('DOMContentLoaded', loadConfigAndInitSupabase);