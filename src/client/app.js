import { obtenerMenu, enviarPedido, escucharPedidoIndividual, escucharColaActiva, actualizarEstadoPedido, restaurarStockPedido, escaparHtml } from '../services/dbOperations.js';

// ============================================================
// CARRITO GLOBAL con localStorage
// ============================================================
function cargarCarritoDesdeStorage() {
  try {
    const saved = localStorage.getItem('plazaflow_carrito');
    return saved ? JSON.parse(saved) : [];
  } catch { return []; }
}
function guardarCarritoEnStorage() {
  localStorage.setItem('plazaflow_carrito', JSON.stringify(window.carrito));
}
window.carrito = cargarCarritoDesdeStorage();

// Cache de productos para compartir entre páginas
function guardarProductosEnCache(productos) {
  localStorage.setItem('plazaflow_productos', JSON.stringify(productos));
}
function cargarProductosDesdeCache() {
  try {
    const saved = localStorage.getItem('plazaflow_productos');
    return saved ? JSON.parse(saved) : [];
  } catch { return []; }
}

// ============================================================
// EMOJIS POR CATEGORÍA
// ============================================================
const categoriaEmoji = {
  'Tacos': '🌮', 'Refrescos 600ml': '🥤', 'Otros Líquidos': '🧃',
  'Sabritas': '🍿', 'Especialidades': '⭐',
};

// ============================================================
// TARJETA DE PRODUCTO CON STEPPER
// ============================================================
function obtenerCantidadEnCarrito(productId) {
  const item = window.carrito.find(i => i.id === productId);
  return item ? item.cantidad : 0;
}

function crearTarjetaProducto(producto) {
  const nombreSanitizado = escaparHtml(producto.nombre || 'Sin nombre');
  const precio = Number(producto.precio) || 0;
  const categoriaSanitizada = escaparHtml(producto.categoria || 'General');
  const emoji = categoriaEmoji[producto.categoria] || '🍽️';
  const tieneOpciones = producto.opciones && producto.opciones.length > 0;
  const stock = producto.stock !== undefined ? producto.stock : (producto.disponible !== false ? 10 : 0);
  const disponible = stock > 0;
  const cantidad = obtenerCantidadEnCarrito(producto.id);

  const heroMedia = producto.imagen ?
    `<img src="${escaparHtml(producto.imagen)}" class="w-full h-full object-cover" alt="${nombreSanitizado}" loading="lazy"/>` :
    emoji;

  return `
    <article class="bg-white rounded-card p-3 shadow-soft flex items-start gap-4 transition-all duration-300 hover:shadow-lg ${!disponible ? 'opacity-50 pointer-events-none' : ''}"
      data-product-id="${producto.id}" data-product-nombre="${nombreSanitizado}" data-product-precio="${precio}" data-product-categoria="${categoriaSanitizada}" ${tieneOpciones ? `data-product-opciones='${escaparHtml(JSON.stringify(producto.opciones))}'` : ''}>
      
      <!-- Imagen Premium (100px) -->
      <div class="w-[100px] h-[96px] flex-shrink-0 rounded-[16px] bg-gradient-to-br from-plaza-highlight to-plaza-bg flex items-center justify-center text-4xl select-none cursor-pointer btn-open-detail relative overflow-hidden">
        ${heroMedia}
        ${!disponible ?
      `<span class="absolute top-0 left-0 w-full bg-red-500/90 text-white text-[9px] font-bold py-1 text-center uppercase tracking-wider">Agotado</span>` :
      `<span class="absolute top-0 left-0 bg-plaza-primary/10 text-plaza-primary text-[9px] font-bold px-2 py-1 rounded-br-lg border-b border-r border-plaza-primary/20">Stock: ${stock}</span>`
    }
      </div>

      <!-- Info Fluida -->
      <div class="flex-1 min-w-0 flex flex-col justify-between h-[96px] py-1">
        <div class="cursor-pointer btn-open-detail min-w-0">
          <h3 class="font-heading font-semibold text-[15px] text-plaza-text leading-tight mb-1 truncate">${nombreSanitizado}</h3>
          <p class="text-xs text-plaza-muted leading-relaxed truncate">${categoriaSanitizada}</p>
        </div>
        
        <div class="flex items-center justify-between gap-2 mt-auto">
          <span class="font-heading font-bold text-lg text-plaza-primary shrink-0">$${precio.toFixed(2)}</span>
          
          <!-- Controles de cantidad integrados en el flujo -->
          <div class="flex items-center gap-2">
            ${cantidad > 0 ? `
              <button class="btn-quitar w-8 h-8 rounded-full bg-plaza-highlight text-plaza-primary flex items-center justify-center active:scale-90 transition-all" data-id="${producto.id}">
                <span class="material-symbols-outlined text-[18px] font-bold">remove</span>
              </button>
              <span class="w-6 text-center font-heading font-bold text-sm text-plaza-text">${cantidad}</span>
            ` : ''}
            <button class="btn-agregar w-9 h-9 rounded-full bg-plaza-primary text-white shadow-md shadow-plaza-primary/30 flex items-center justify-center active:scale-90 transition-all" 
              data-id="${producto.id}" ${tieneOpciones ? 'data-has-options="true"' : ''}>
              <span class="material-symbols-outlined text-[20px] font-bold">${cantidad > 0 ? 'add' : 'add'}</span>
            </button>
          </div>
        </div>
      </div>
    </article>`;
}

// ============================================================
// RENDERIZADO Y SKELETONS
// ============================================================
let todosLosProductos = [];

function renderizarMenu(productos) {
  const grid = document.getElementById('client-menu-grid');
  if (!grid) return;
  if (productos.length === 0) {
    grid.innerHTML = `<div class="text-center py-12"><span class="material-symbols-outlined text-5xl text-plaza-muted mb-3 block">search_off</span><p class="font-heading font-medium text-plaza-muted">No hay productos en esta categoría</p></div>`;
    return;
  }
  grid.innerHTML = productos.map(crearTarjetaProducto).join('');
  vincularBotonesMenu();
}

function mostrarSkeletons() {
  const grid = document.getElementById('client-menu-grid');
  if (!grid) return;
  const sk = `<article class="bg-white rounded-card p-3 shadow-soft flex items-start gap-4 h-[120px] animate-pulse"><div class="w-[100px] h-full flex-shrink-0 rounded-[16px] bg-gray-200"></div><div class="flex-1 py-1 flex flex-col justify-between h-full pr-10"><div><div class="h-4 bg-gray-200 rounded w-3/4 mb-2"></div><div class="h-3 bg-gray-200 rounded w-full mb-1"></div></div><div class="h-5 bg-gray-200 rounded w-1/4 mt-auto"></div></div></article>`;
  grid.innerHTML = sk.repeat(4) + `<div class="text-center w-full py-4 text-plaza-muted font-medium animate-pulse">Cargando Platos...</div>`;
}

// ============================================================
// FILTRADO POR CATEGORÍA
// ============================================================
const mapaCategoriasUI = {
  'Todos': null, 'Populares': null, 'Tacos': 'Tacos',
  'Extras': 'Especialidades', 'Bebidas': ['Refrescos 600ml', 'Otros Líquidos'], 'Sabritas': 'Sabritas',
};

function filtrarPorCategoria(nombre) {
  const filtro = mapaCategoriasUI[nombre];
  let lista;
  if (!filtro) lista = todosLosProductos;
  else if (Array.isArray(filtro)) lista = todosLosProductos.filter(p => filtro.includes(p.categoria));
  else lista = todosLosProductos.filter(p => p.categoria === filtro);
  renderizarMenu(lista);
}

function configurarFiltrosCategorias() {
  const nav = document.querySelector('nav');
  if (!nav) return;
  const botones = nav.querySelectorAll('button');
  botones.forEach(btn => {
    btn.addEventListener('click', () => {
      const texto = btn.textContent.trim().replace(/^[^\w\s]+\s*/, '');
      botones.forEach(b => { b.classList.remove('bg-plaza-primary', 'text-white', 'shadow-md', 'shadow-plaza-primary/30'); b.classList.add('bg-white', 'text-plaza-text', 'shadow-sm'); });
      btn.classList.remove('bg-white', 'text-plaza-text', 'shadow-sm');
      btn.classList.add('bg-plaza-primary', 'text-white', 'shadow-md', 'shadow-plaza-primary/30');

      // Clear search when clicking category
      const searchInput = document.getElementById('client-search-input');
      if (searchInput) searchInput.value = '';

      filtrarPorCategoria(texto);
    });
  });

  nav.addEventListener('wheel', (e) => {
    if (e.deltaY !== 0) {
      e.preventDefault();
      nav.scrollLeft += e.deltaY;
    }
  });
}

function configurarBuscador() {
  const searchInput = document.getElementById('client-search-input');
  if (!searchInput) return;

  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();

    // Clear category selection if searching
    if (query.length > 0) {
      const nav = document.querySelector('nav');
      if (nav) {
        const botones = nav.querySelectorAll('button');
        botones.forEach(b => {
          b.classList.remove('bg-plaza-primary', 'text-white', 'shadow-md', 'shadow-plaza-primary/30');
          b.classList.add('bg-white', 'text-plaza-text', 'shadow-sm');
        });
      }
    }

    if (!query) {
      // If empty, restore "Todos" category or just show all
      renderizarMenu(todosLosProductos);
      return;
    }

    const resultados = todosLosProductos.filter(p => {
      const matchName = (p.nombre || '').toLowerCase().includes(query);
      const matchDesc = (p.descripcion || '').toLowerCase().includes(query);
      const matchCat = (p.categoria || '').toLowerCase().includes(query);
      return matchName || matchDesc || matchCat;
    });

    renderizarMenu(resultados);
  });
}

// ============================================================
// LÓGICA DE AGREGAR / QUITAR EN EL MENÚ
// ============================================================
function agregarAlCarrito(productId) {
  const producto = todosLosProductos.find(p => p.id === productId) ||
    cargarProductosDesdeCache().find(p => p.id === productId);
  if (!producto) return;
  const stock = producto.stock !== undefined ? producto.stock : (producto.disponible !== false ? 10 : 0);

  const existente = window.carrito.find(i => i.id === productId);
  if (existente) {
    if (existente.cantidad >= stock) {
      alert(`Solo quedan ${stock} unidades de este producto.`);
      return;
    }
    existente.cantidad += 1;
  }
  else {
    if (stock <= 0) return;
    window.carrito.push({
      id: producto.id, nombre: producto.nombre || 'Producto',
      precio: Number(producto.precio) || 0, categoria: producto.categoria || 'General',
      imagen: producto.imagen || null,
      cantidad: 1, opcionSeleccionada: null
    });
  }
  guardarCarritoEnStorage(); actualizarUICarrito(); reRenderCards();
}

function agregarConOpcion(productId, opcion) {
  const producto = todosLosProductos.find(p => p.id === productId) ||
    cargarProductosDesdeCache().find(p => p.id === productId);
  if (!producto) return;
  const stock = producto.stock !== undefined ? producto.stock : (producto.disponible !== false ? 10 : 0);
  // Para productos con opciones, el key es id+opción
  const key = `${productId}_${opcion}`;

  // Contar cantidad total de este producto en el carrito (todas las opciones sumadas)
  const totalEnCarrito = window.carrito.filter(i => i.id === productId).reduce((acc, curr) => acc + curr.cantidad, 0);

  if (totalEnCarrito >= stock) {
    alert(`Solo quedan ${stock} unidades de este producto en total.`);
    return;
  }

  const existente = window.carrito.find(i => i.cartKey === key);
  if (existente) { existente.cantidad += 1; }
  else {
    window.carrito.push({
      id: producto.id, cartKey: key, nombre: producto.nombre || 'Producto',
      precio: Number(producto.precio) || 0, categoria: producto.categoria || 'General',
      imagen: producto.imagen || null,
      cantidad: 1, opcionSeleccionada: opcion
    });
  }
  guardarCarritoEnStorage(); actualizarUICarrito(); reRenderCards();
}

function quitarDelCarrito(productId) {
  const idx = window.carrito.findIndex(i => i.id === productId);
  if (idx === -1) return;
  window.carrito[idx].cantidad -= 1;
  if (window.carrito[idx].cantidad <= 0) window.carrito.splice(idx, 1);
  guardarCarritoEnStorage(); actualizarUICarrito(); reRenderCards();
}

function reRenderCards() {
  // Re-render solo si estamos en la página del menú
  const grid = document.getElementById('client-menu-grid');
  if (!grid || todosLosProductos.length === 0) return;
  const filtro = mapaCategoriasUI[document.querySelector('nav .bg-plaza-primary')?.textContent.trim().replace(/^[^\w\s]+\s*/, '') || 'Todos'];
  let lista;
  if (!filtro) lista = todosLosProductos;
  else if (Array.isArray(filtro)) lista = todosLosProductos.filter(p => filtro.includes(p.categoria));
  else lista = todosLosProductos.filter(p => p.categoria === filtro);
  renderizarMenu(lista);
}

function vincularBotonesMenu() {
  // Botones AGREGAR (+)
  document.querySelectorAll('.btn-agregar').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const card = e.target.closest('article');
      const id = btn.dataset.id || card?.dataset.productId;
      if (btn.dataset.hasOptions === 'true') {
        // Abrir item-detail para seleccionar opción
        window.location.href = `/producto?id=${id}`;
        return;
      }
      agregarAlCarrito(id);
    });
  });
  // Botones QUITAR (-)
  document.querySelectorAll('.btn-quitar').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      quitarDelCarrito(btn.dataset.id);
    });
  });
  // Clic en imagen/nombre → abrir detalle
  document.querySelectorAll('.btn-open-detail').forEach(el => {
    el.addEventListener('click', () => {
      const card = el.closest('article');
      if (card) window.location.href = `/producto?id=${card.dataset.productId}`;
    });
  });
}

// ============================================================
// BARRA FLOTANTE DEL CARRITO
// ============================================================
function actualizarUICarrito() {
  const countBadge = document.getElementById('cart-item-count');
  const totalText = document.getElementById('cart-total-price');
  const cartBar = document.getElementById('btn-open-cart');
  const totalItems = window.carrito.reduce((a, i) => a + i.cantidad, 0);
  const totalPrecio = window.carrito.reduce((a, i) => a + (i.precio * i.cantidad), 0);
  if (countBadge) countBadge.innerText = totalItems;
  if (totalText) totalText.innerText = `$${totalPrecio.toFixed(2)}`;
  if (cartBar) {
    const bar = cartBar.closest('.fixed');
    if (bar) {
      bar.style.transition = 'transform 0.3s ease-in-out';
      bar.style.transform = totalItems === 0 ? 'translateY(100%)' : 'translateY(0)';
    }
  }
}

function configurarNavegacionCarrito() {
  const btn = document.getElementById('btn-open-cart');
  if (btn) btn.addEventListener('click', () => { window.location.href = '/carrito'; });
}

// ============================================================
// CHECKOUT DINÁMICO
// ============================================================
let tipPorcentaje = 15;

function inicializarCheckoutPage() {
  const subtotalEl = document.getElementById('checkout-subtotal');
  if (!subtotalEl) return;

  const subtotal = window.carrito.reduce((a, i) => a + (i.precio * i.cantidad), 0);
  subtotalEl.textContent = `$${subtotal.toFixed(2)}`;
  actualizarTotalCheckout(subtotal);

  // Tip buttons
  const tipBtns = document.querySelectorAll('[data-tip]');
  // If no data-tip attrs, use the existing tip grid buttons
  const tipGrid = document.querySelector('.grid-cols-4');
  if (tipGrid) {
    const btns = tipGrid.querySelectorAll('button');
    const tipValues = [10, 15, 20, 'custom'];
    btns.forEach((btn, i) => {
      btn.addEventListener('click', () => {
        if (tipValues[i] === 'custom') {
          const customTip = prompt("Ingresa el porcentaje de propina (ej. 25):");
          const parsed = parseInt(customTip);
          if (!isNaN(parsed) && parsed >= 0) {
            tipPorcentaje = parsed;
          } else {
            return;
          }
        } else {
          tipPorcentaje = tipValues[i];
        }

        btns.forEach(b => {
          b.classList.remove('bg-plaza-secondary', 'border-plaza-secondary', 'shadow-md', 'scale-105');
          b.classList.add('bg-white', 'border-transparent');
        });
        btn.classList.remove('bg-white', 'border-transparent');
        btn.classList.add('bg-plaza-secondary', 'border-plaza-secondary', 'shadow-md', 'scale-105');
        actualizarTotalCheckout(subtotal);
      });
    });
  }

  // Payment method selection
  const paymentCards = document.querySelectorAll('.payment-method-card');
  if (paymentCards.length > 0) {
    paymentCards.forEach(card => {
      card.addEventListener('click', () => {
        paymentCards.forEach(c => {
          c.classList.remove('border-primary');
          c.classList.add('border-transparent');
          const icon = c.querySelector('.check-icon');
          if (icon) icon.classList.add('hidden');
        });
        card.classList.remove('border-transparent');
        card.classList.add('border-primary');
        const icon = card.querySelector('.check-icon');
        if (icon) icon.classList.remove('hidden');
        window.selectedPaymentMethod = card.dataset.method;
      });
    });
  }

  // Slide to pay
  configurarSlideToPay();
}

function actualizarTotalCheckout(subtotal) {
  const tipAmount = subtotal * (tipPorcentaje / 100);
  const total = subtotal + tipAmount;
  const tipEl = document.getElementById('checkout-tip');
  const totalEl = document.getElementById('checkout-total');
  const emojiEl = document.getElementById('checkout-tip-emoji');
  if (tipEl) tipEl.textContent = tipPorcentaje > 0 ? `$${tipAmount.toFixed(2)}` : '$0.00';
  if (totalEl) totalEl.textContent = `$${total.toFixed(2)}`;
  if (emojiEl) emojiEl.textContent = tipPorcentaje >= 20 ? '🤩' : tipPorcentaje >= 15 ? '🙂' : tipPorcentaje >= 10 ? '😐' : '😶';
}

function configurarSlideToPay() {
  const btn = document.getElementById('btn-pay-checkout');
  if (btn) {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.innerHTML = '<span class="material-symbols-outlined animate-spin text-white">sync</span> Procesando...';
      await handleCheckout();
      btn.disabled = false;
      btn.innerHTML = 'Confirmar Pedido 🌮';
    });
  }
}

async function handleCheckout() {
  if (window.carrito.length === 0) { alert('El carrito está vacío.'); return; }

  const nameInput = document.getElementById('checkout-customer-name');
  const clienteNombre = nameInput ? nameInput.value.trim() : '';
  if (!clienteNombre) {
    alert('Por favor ingresa tu nombre para identificar tu pedido.');
    if (nameInput) nameInput.focus();
    return;
  }
  localStorage.setItem('plazaflow_cliente_nombre', clienteNombre);

  try {
    const productosDB = await obtenerMenu();
    for (const item of window.carrito) {
      const prodDB = productosDB.find(p => p.id === item.id);
      const stockDisp = prodDB && prodDB.stock !== undefined ? prodDB.stock : (prodDB && prodDB.disponible !== false ? 10 : 0);
      if (item.cantidad > stockDisp) {
        alert(`❌ No hay suficiente stock para "${item.nombre}". Stock disponible: ${stockDisp}. Por favor ajusta tu carrito antes de pagar.`);
        return;
      }
    }
  } catch (error) {
    console.error('Error validando stock', error);
  }

  const subtotal = window.carrito.reduce((a, i) => a + (i.precio * i.cantidad), 0);
  const tipAmount = subtotal * (tipPorcentaje / 100);
  const total = subtotal + tipAmount;

  const origin = window.location.origin;
  const successUrl = `${origin}/success`;
  const cancelUrl = `${origin}/checkout`;

  const metodoPago = window.selectedPaymentMethod || 'Tarjeta';

  if (metodoPago === 'Efectivo') {
    const datosPedido = {
      clienteNombre,
      items: window.carrito.map(i => ({ id: i.id, nombre: i.nombre, precio: i.precio, cantidad: i.cantidad, opcion: i.opcionSeleccionada || null })),
      subtotal, propina: tipAmount, total, metodoPago: 'Efectivo', estado: 'pago_pendiente'
    };
    try {
      const orderId = await enviarPedido(datosPedido);
      window.carrito = []; guardarCarritoEnStorage(); actualizarUICarrito();
      window.location.href = `/tracking?orderId=${orderId}`;
    } catch (error) { alert('Error al enviar el pedido.'); console.error(error); }
    return;
  }

  try {
    const checkoutUrl = import.meta.env.VITE_CHECKOUT_URL || 'http://localhost:3005/create-checkout-session';
    const response = await fetch(checkoutUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: window.carrito,
        successUrl,
        cancelUrl,
        propina: tipAmount
      })
    });

    const session = await response.json();
    if (session.error) {
      alert(`Error: ${session.error}`);
      return;
    }

    // Redirigir a Stripe Checkout
    window.location.href = session.url;
  } catch (error) {
    alert('Error al conectar con la pasarela de pagos. Por favor verifica que el servidor esté en ejecución.');
    console.error(error);
  }
}

function configurarCheckout() {
  const btnCart = document.getElementById('btn-checkout-cart');
  if (btnCart) {
    btnCart.addEventListener('click', () => {
      window.location.href = '/checkout';
    });
  }
}

// ============================================================
// INICIALIZACIÓN
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  actualizarUICarrito();
  configurarNavegacionCarrito();
  configurarCheckout();

  // --- MENÚ (index.html) ---
  const grid = document.getElementById('client-menu-grid');
  if (grid) {
    mostrarSkeletons();
    try {
      const menuCompleto = await obtenerMenu();
      todosLosProductos = menuCompleto.filter(p => {
        const stock = p.stock !== undefined ? p.stock : (p.disponible !== false ? 10 : 0);
        return stock > 0 && p.disponible !== false;
      });
      guardarProductosEnCache(todosLosProductos);
      renderizarMenu(todosLosProductos);
      configurarFiltrosCategorias();
      configurarBuscador();
    } catch (error) {
      console.error('❌ Error cargando el menú:', error);
      grid.innerHTML = `<div class="text-center py-12"><span class="material-symbols-outlined text-5xl text-red-300 mb-3 block">cloud_off</span><p class="font-heading font-medium text-plaza-text mb-1">Error al cargar el menú</p><button onclick="window.location.reload()" class="mt-4 px-6 py-2 bg-plaza-primary text-white rounded-pill font-heading font-medium shadow-md">Reintentar</button></div>`;
    }
  }

  // --- CART (cart.html) ---
  inicializarCart();

  // --- ITEM DETAIL (item-detail.html) ---
  inicializarItemDetail();

  // --- CHECKOUT (checkout.html) ---
  inicializarCheckoutPage();

  // --- TRACKING (tracking.html) ---
  inicializarTracking();

  // --- Botón Volver ---
  document.getElementById('btn-back-cart')?.addEventListener('click', () => history.back());
  document.getElementById('btn-back-checkout')?.addEventListener('click', () => history.back());
  document.getElementById('btn-close-item-detail')?.addEventListener('click', () => history.back());
});

// ============================================================
// CART.HTML DINÁMICO
// ============================================================
function inicializarCart() {
  const cartList = document.getElementById('cart-items-list');
  if (!cartList) return;

  const btnEmpty = document.getElementById('btn-empty-cart');
  if (btnEmpty) {
    btnEmpty.addEventListener('click', () => {
      if (confirm('¿Estás seguro de vaciar toda la bandeja?')) {
        window.carrito = [];
        guardarCarritoEnStorage();
        renderizarCart();
        actualizarUICarrito();
      }
    });
  }

  renderizarCart();
}

function renderizarCart() {
  const cartList = document.getElementById('cart-items-list');
  if (!cartList) return;

  if (window.carrito.length === 0) {
    cartList.innerHTML = `<div class="text-center py-16"><span class="material-symbols-outlined text-6xl text-gray-300 mb-4 block">shopping_cart</span><p class="font-heading font-bold text-xl text-gray-400 mb-2">Tu bandeja está vacía</p><p class="text-sm text-gray-400">Agrega productos desde el menú</p><a href="index.html" class="inline-block mt-6 px-8 py-3 bg-primary text-white rounded-pill font-heading font-bold shadow-md hover:shadow-lg transition-all">Ver Menú</a></div>`;
    actualizarTotalesCart();
    return;
  }

  const emojis = categoriaEmoji;
  cartList.innerHTML = window.carrito.map(item => {
    const emoji = emojis[item.categoria] || '🍽️';
    const opcionLabel = item.opcionSeleccionada ? `<p class="text-sm text-gray-400 truncate">Tortilla: ${escaparHtml(item.opcionSeleccionada)}</p>` : '';

    const cartMedia = item.imagen ?
      `<img src="${escaparHtml(item.imagen)}" class="w-full h-full object-cover" alt="${escaparHtml(item.nombre)}" loading="lazy"/>` :
      emoji;

    return `
    <div class="group relative bg-white p-3 rounded-2xl shadow-soft flex gap-4 overflow-hidden" data-cart-id="${item.cartKey || item.id}">
      <div class="w-[72px] h-[72px] shrink-0 rounded-2xl bg-gradient-to-br from-plaza-highlight to-plaza-bg flex items-center justify-center text-3xl overflow-hidden">${cartMedia}</div>
      <div class="flex-1 flex flex-col justify-center min-w-0">
        <div class="flex justify-between items-start">
          <h3 class="font-heading font-bold text-base leading-tight truncate pr-2">${escaparHtml(item.nombre)}</h3>
          <span class="font-heading font-bold text-base text-plaza-primary whitespace-nowrap">$${(item.precio * item.cantidad).toFixed(2)}</span>
        </div>
        ${opcionLabel}
        <div class="flex items-center justify-between mt-2">
          <button class="cart-delete text-red-400 hover:text-red-600 p-1 -ml-1 rounded-full hover:bg-red-50 transition-colors" data-cart-id="${item.cartKey || item.id}">
            <span class="material-symbols-outlined text-[20px]">delete</span>
          </button>
          <div class="flex items-center bg-gray-50 rounded-pill p-1 border border-gray-100">
            <button class="cart-minus w-7 h-7 flex items-center justify-center rounded-full bg-white shadow-sm hover:scale-110 transition active:scale-90" data-cart-id="${item.cartKey || item.id}">
              <span class="material-symbols-outlined text-[16px] font-bold">remove</span>
            </button>
            <span class="w-8 text-center font-heading font-bold text-sm">${item.cantidad}</span>
            <button class="cart-plus w-7 h-7 flex items-center justify-center rounded-full bg-primary text-white shadow-sm hover:scale-110 transition active:scale-90" data-cart-id="${item.cartKey || item.id}">
              <span class="material-symbols-outlined text-[16px] font-bold">add</span>
            </button>
          </div>
        </div>
      </div>
    </div>`;
  }).join('');

  // Vincular eventos del cart
  cartList.querySelectorAll('.cart-plus').forEach(btn => {
    btn.addEventListener('click', () => { modificarItemCart(btn.dataset.cartId, 1); });
  });
  cartList.querySelectorAll('.cart-minus').forEach(btn => {
    btn.addEventListener('click', () => { modificarItemCart(btn.dataset.cartId, -1); });
  });
  cartList.querySelectorAll('.cart-delete').forEach(btn => {
    btn.addEventListener('click', () => { eliminarItemCart(btn.dataset.cartId); });
  });

  actualizarTotalesCart();
}

function modificarItemCart(cartId, delta) {
  const item = window.carrito.find(i => (i.cartKey || i.id) === cartId);
  if (!item) return;
  item.cantidad += delta;
  if (item.cantidad <= 0) window.carrito.splice(window.carrito.indexOf(item), 1);
  guardarCarritoEnStorage(); renderizarCart(); actualizarUICarrito();
}

function eliminarItemCart(cartId) {
  window.carrito = window.carrito.filter(i => (i.cartKey || i.id) !== cartId);
  guardarCarritoEnStorage(); renderizarCart(); actualizarUICarrito();
}

function actualizarTotalesCart() {
  const subtotal = window.carrito.reduce((a, i) => a + (i.precio * i.cantidad), 0);
  const el = {
    sub: document.getElementById('cart-drawer-subtotal'),
    total: document.getElementById('cart-drawer-total'),
    totalBig: document.querySelector('.cart-total-big'),
    btnTotal: document.getElementById('btn-checkout-cart'),
  };
  if (el.sub) el.sub.textContent = `$${subtotal.toFixed(2)}`;
  if (el.total) el.total.textContent = `$${subtotal.toFixed(2)}`;
  if (el.totalBig) el.totalBig.textContent = `$${subtotal.toFixed(2)}`;
  // Ocultar botón checkout si vacío
  if (el.btnTotal) el.btnTotal.style.opacity = window.carrito.length === 0 ? '0.5' : '1';
}

// ============================================================
// ITEM-DETAIL DINÁMICO
// ============================================================
function inicializarItemDetail() {
  const titleEl = document.getElementById('item-detail-title');
  if (!titleEl) return;

  const params = new URLSearchParams(window.location.search);
  const productId = params.get('id');
  if (!productId) return;

  const productos = cargarProductosDesdeCache();
  const producto = productos.find(p => p.id === productId);
  if (!producto) return;

  const nombreSanitizado = escaparHtml(producto.nombre || 'Producto');
  const precio = Number(producto.precio) || 0;
  const categoriaSanitizada = escaparHtml(producto.categoria || 'General');
  const emoji = categoriaEmoji[producto.categoria] || '🍽️';
  const tieneOpciones = producto.opciones && producto.opciones.length > 0;

  // Rellenar contenido
  titleEl.textContent = nombreSanitizado;
  const heroEl = document.getElementById('item-detail-hero');
  if (heroEl) {
    heroEl.classList.remove('animate-pulse');
    heroEl.classList.add('overflow-hidden');
    if (producto.imagen) {
      heroEl.innerHTML = `<img src="${escaparHtml(producto.imagen)}" class="w-full h-full object-cover" alt="${nombreSanitizado}"/>`;
    } else {
      heroEl.innerHTML = `<span class="text-7xl">${emoji}</span>`;
    }
  }
  const priceEl = document.getElementById('item-detail-price');
  if (priceEl) priceEl.textContent = `$${precio.toFixed(2)}`;
  const descEl = document.getElementById('item-detail-desc');
  if (descEl) descEl.textContent = `${nombreSanitizado} — ${categoriaSanitizada}`;

  // Opciones dinámicas
  const optContainer = document.getElementById('item-detail-options');
  if (optContainer && tieneOpciones) {
    optContainer.innerHTML = `
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-heading font-bold text-lg">Tipo de Tortilla</h3>
        <span class="text-xs font-bold text-red-400 bg-red-50 px-2 py-1 rounded-lg uppercase tracking-wide">Obligatorio</span>
      </div>
      <div class="flex flex-col gap-3">
        ${producto.opciones.map((op, i) => `
        <label class="group flex items-center justify-between p-4 bg-white rounded-2xl border-2 border-transparent hover:border-red-100 has-[:checked]:border-red-400 has-[:checked]:bg-red-50/10 transition-all cursor-pointer shadow-sm">
          <span class="font-bold">${escaparHtml(op)}</span>
          <input type="radio" name="opcion-tortilla" value="${escaparHtml(op)}" ${i === 0 ? 'checked' : ''} class="w-6 h-6 border-2 border-gray-300 text-red-400 focus:ring-red-400 squishy-radio"/>
        </label>`).join('')}
      </div>`;
  } else if (optContainer) {
    optContainer.innerHTML = '';
  }

  // Stepper del detail
  let cantidad = 1;
  const qtyEl = document.getElementById('item-detail-qty');
  const btnMinus = document.getElementById('item-detail-minus');
  const btnPlus = document.getElementById('item-detail-plus');
  const btnConfirm = document.getElementById('btn-confirm-add-item');
  const stock = producto.stock !== undefined ? producto.stock : (producto.disponible !== false ? 10 : 0);

  // Si no hay stock, ocultar todo y mostrar agotado
  if (stock <= 0) {
    if (btnConfirm) {
      btnConfirm.disabled = true;
      btnConfirm.textContent = 'Agotado';
      btnConfirm.classList.replace('bg-plaza-text', 'bg-gray-400');
    }
    if (btnMinus) btnMinus.style.display = 'none';
    if (btnPlus) btnPlus.style.display = 'none';
    if (qtyEl) qtyEl.textContent = '0';
  } else {
    // Si hay stock, asegurar que la cantidad visual inicie bien
    if (btnConfirm) {
      btnConfirm.disabled = false;
      btnConfirm.textContent = 'Añadir a Bandeja';
      btnConfirm.classList.replace('bg-gray-400', 'bg-plaza-text');
    }
    if (btnMinus) btnMinus.style.display = '';
    if (btnPlus) btnPlus.style.display = '';
  }

  function updateDetailUI() {
    const yaEnCarrito = window.carrito.filter(i => i.id === productId).reduce((acc, curr) => acc + curr.cantidad, 0);
    if (qtyEl) qtyEl.textContent = cantidad;
    if (priceEl) priceEl.textContent = `$${(precio * cantidad).toFixed(2)}`;

    // Deshabilitar botón + si alcanzamos el stock
    if (btnPlus) {
      if (cantidad + yaEnCarrito >= stock) {
        btnPlus.classList.add('opacity-30', 'grayscale');
      } else {
        btnPlus.classList.remove('opacity-30', 'grayscale');
      }
    }
  }
  updateDetailUI();

  if (btnMinus) btnMinus.addEventListener('click', () => { if (cantidad > 1) { cantidad--; updateDetailUI(); } });
  if (btnPlus) btnPlus.addEventListener('click', () => {
    const yaEnCarrito = window.carrito.filter(i => i.id === productId).reduce((acc, curr) => acc + curr.cantidad, 0);
    if (cantidad + yaEnCarrito < stock) {
      cantidad++;
      updateDetailUI();
    } else {
      alert(`Solo quedan ${stock} unidades disponibles en total (incluyendo las que ya tienes en el carrito).`);
    }
  });

  if (btnConfirm) {
    btnConfirm.addEventListener('click', () => {
      if (tieneOpciones) {
        const sel = document.querySelector('input[name="opcion-tortilla"]:checked');
        const opcion = sel ? sel.value : producto.opciones[0];
        for (let i = 0; i < cantidad; i++) agregarConOpcion(productId, opcion);
      } else {
        for (let i = 0; i < cantidad; i++) agregarAlCarrito(productId);
      }
      history.back();
    });
  }
}

// ============================================================
// TRACKING EN TIEMPO REAL
// ============================================================
const TIEMPO_PROMEDIO_POR_PEDIDO = 3; // minutos estimados por pedido
const CIRCUNFERENCIA = 283; // 2 * PI * 45 (radio del SVG circle)
let progressInterval = null;
let trackingEstado = null;
let trackingPedidoCache = null;

function inicializarTracking() {
  const statusTitle = document.getElementById('status-title');
  if (!statusTitle) return;

  const params = new URLSearchParams(window.location.search);
  const orderId = params.get('orderId');
  if (!orderId) return;

  const ticketEl = document.getElementById('ticket-number');
  if (ticketEl) ticketEl.textContent = `#${orderId.slice(-4).toUpperCase()}`;

  // --- Escuchar cola activa para posición real ---
  escucharColaActiva((pedidosActivos) => {
    const miIdx = pedidosActivos.findIndex(p => p.id === orderId);
    const pedidosAntes = miIdx >= 0 ? miIdx : 0;
    actualizarCola(pedidosAntes);
  });

  // --- Escuchar estado del pedido ---
  escucharPedidoIndividual(orderId, (pedido) => {
    const estado = pedido.estado || 'nuevo';
    const prevEstado = trackingEstado;
    trackingEstado = estado;
    trackingPedidoCache = pedido;

    actualizarUITracking(estado, pedido);

    const cancelContainer = document.getElementById('client-cancel-container');
    if (cancelContainer) {
      if (estado === 'nuevo' || estado === 'pago_pendiente') {
        cancelContainer.classList.remove('hidden');
      } else {
        cancelContainer.classList.add('hidden');
      }
    }

    // Iniciar/reiniciar animación de progreso al cambiar de estado
    if (estado !== prevEstado) {
      iniciarProgresoAnimado(estado, pedido.timestamp);
    }
  });

  const btnCancel = document.getElementById('btn-client-cancel');
  if (btnCancel) {
    btnCancel.onclick = async () => {
      if (!btnCancel.dataset.confirmado) {
        btnCancel.dataset.confirmado = "true";
        btnCancel.innerHTML = '<span class="material-symbols-outlined text-[18px]">warning</span> ¿Seguro? Clic para confirmar';
        btnCancel.classList.remove('bg-red-50', 'text-red-600', 'dark:bg-red-900/20', 'dark:text-red-400');
        btnCancel.classList.add('bg-red-600', 'text-white', 'shadow-md');

        // Timeout para resetear si no hace el segundo clic
        setTimeout(() => {
          if (!btnCancel.disabled && btnCancel.dataset.confirmado) {
            btnCancel.dataset.confirmado = "";
            btnCancel.innerHTML = '<span class="material-symbols-outlined text-[18px]">cancel</span> Cancelar Pedido';
            btnCancel.classList.add('bg-red-50', 'text-red-600', 'dark:bg-red-900/20', 'dark:text-red-400');
            btnCancel.classList.remove('bg-red-600', 'text-white', 'shadow-md');
          }
        }, 3000);
        return;
      }

      // Proceder con cancelación
      btnCancel.disabled = true;
      btnCancel.innerHTML = '<span class="material-symbols-outlined animate-spin">sync</span> Cancelando...';

      try {
        if (trackingPedidoCache && trackingPedidoCache.stripeSessionId && trackingPedidoCache.metodoPago !== 'Efectivo') {
          try {
            const refundUrl = import.meta.env.VITE_REFUND_URL || 'http://localhost:3005/refund-session';
            const res = await fetch(refundUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ session_id: trackingPedidoCache.stripeSessionId })
            });
            if (!res.ok) console.warn('Problema contactando a Stripe para reembolso');
          } catch (err) {
            console.error('Servidor local apagado / error de red:', err);
          }
        }
        await actualizarEstadoPedido(orderId, 'cancelado');
        if (trackingPedidoCache && trackingPedidoCache.items) {
          await restaurarStockPedido(trackingPedidoCache.items);
        }
      } catch (e) {
        console.error("Error cancelando:", e);
        alert('Hubo un error al cancelar. Actualiza la página.');
      } finally {
        btnCancel.innerHTML = '<span class="material-symbols-outlined text-[18px]">cancel</span> Cancelado';
        btnCancel.dataset.confirmado = "";
      }
    };
  }
}

function actualizarCola(pedidosAntes) {
  const dotsEl = document.getElementById('queue-dots');
  const textEl = document.getElementById('queue-text');
  const queueCard = document.getElementById('queue-card');
  if (!dotsEl || !textEl) return;

  // Si listo, ocultar tarjeta de cola
  if (trackingEstado === 'listo') {
    if (queueCard) queueCard.style.display = 'none';
    return;
  }
  if (queueCard) queueCard.style.display = '';

  // Generar dots: grises = pedidos antes, amarillo = siguiente, rojo = tú
  const totalDots = Math.min(pedidosAntes + 1, 8); // máx 8 dots
  let dotsHTML = '';
  for (let i = 0; i < totalDots; i++) {
    if (i < pedidosAntes - 1) {
      dotsHTML += '<div class="w-2 h-2 rounded-full bg-slate-200 dark:bg-white/20"></div>';
    } else if (i === pedidosAntes - 1 && pedidosAntes > 0) {
      dotsHTML += '<div class="w-2 h-2 rounded-full bg-plaza-yellow animate-pulse"></div>';
    } else {
      dotsHTML += '<div class="w-2 h-2 rounded-full bg-primary"></div>';
    }
  }
  dotsEl.innerHTML = dotsHTML;

  if (pedidosAntes === 0) {
    textEl.innerHTML = '<span class="text-plaza-green font-bold">¡Eres el siguiente!</span>';
  } else {
    textEl.innerHTML = `<span class="text-plaza-text dark:text-white font-bold">${pedidosAntes} pedido${pedidosAntes > 1 ? 's' : ''}</span> antes que el tuyo`;
  }

  // Actualizar tiempo estimado en el badge
  const timeBadge = document.getElementById('time-badge');
  if (timeBadge && trackingEstado !== 'listo') {
    const tiempoEst = trackingEstado === 'preparando'
      ? Math.max(1, Math.ceil(TIEMPO_PROMEDIO_POR_PEDIDO * 0.6))
      : (pedidosAntes + 1) * TIEMPO_PROMEDIO_POR_PEDIDO;
    timeBadge.innerHTML = `<span class="text-xs font-bold text-plaza-text dark:text-white/80">~${tiempoEst} min</span>`;
  }
}

function iniciarProgresoAnimado(estado, timestamp) {
  const indicator = document.getElementById('progress-indicator');
  if (!indicator) return;

  // Limpiar animación previa
  if (progressInterval) clearInterval(progressInterval);

  if (estado === 'listo') {
    // Snap al 100%
    indicator.style.strokeDashoffset = '0';
    return;
  }

  // Rangos de progreso según estado
  // nuevo: 0% → 40%  |  preparando: 40% → 95%
  const rangoInicio = estado === 'nuevo' ? 0 : 0.4;
  const rangoFin = estado === 'nuevo' ? 0.4 : 0.95;
  const duracionMinutos = estado === 'nuevo' ? 8 : 5;

  // Calcular tiempo ya transcurrido desde que entró en este estado
  let elapsed = 0;
  if (timestamp && timestamp.toMillis) {
    elapsed = (Date.now() - timestamp.toMillis()) / 60000; // minutos transcurridos
  }

  const duracionTotal = duracionMinutos * 60; // en segundos
  let segundosTranscurridos = Math.min(elapsed * 60, duracionTotal);

  progressInterval = setInterval(() => {
    segundosTranscurridos += 1;
    const t = Math.min(segundosTranscurridos / duracionTotal, 1);

    // Easing suave (ease-out)
    const eased = 1 - Math.pow(1 - t, 3);
    const progreso = rangoInicio + (rangoFin - rangoInicio) * eased;
    const offset = CIRCUNFERENCIA * (1 - progreso);

    indicator.style.strokeDashoffset = `${offset}`;

    if (t >= 1) clearInterval(progressInterval);
  }, 1000);
}

function actualizarUITracking(estado, pedido) {
  const statusTitle = document.getElementById('status-title');
  const indicator = document.getElementById('progress-indicator');
  const iconContainer = document.getElementById('status-icon');
  const subtitle = document.getElementById('status-subtitle');
  const timeBadge = document.getElementById('time-badge');
  const orbitDot = document.getElementById('orbit-dot');
  const pulse1 = document.getElementById('pulse-ring-1');
  const pulse2 = document.getElementById('pulse-ring-2');
  const bgBlob = document.getElementById('bg-blob');
  const ticketAccent = document.getElementById('ticket-accent');
  const itemCount = document.getElementById('item-count');

  if (itemCount && pedido.items) {
    itemCount.textContent = `${pedido.items.length} Artículos`;
  }

  const paymentWarningContainer = document.getElementById('payment-warning-container');
  if (paymentWarningContainer) {
    if (estado === 'cancelado') {
      if (pedido.metodoPago === 'Efectivo') {
        paymentWarningContainer.innerHTML = `
          <div class="mt-4 p-3 bg-red-50 rounded-xl border border-red-200 flex items-center gap-3">
            <div class="h-10 w-10 bg-red-100 rounded-full flex items-center justify-center shrink-0">
              <span class="material-symbols-outlined text-red-600">block</span>
            </div>
            <div class="flex flex-col">
              <span class="text-sm font-bold text-red-800 leading-tight">Pedido Cancelado</span>
              <span class="text-xs text-red-700 mt-0.5">La orden fue cancelada. No se cobrará nada en mostrador.</span>
            </div>
          </div>
        `;
      } else {
        paymentWarningContainer.innerHTML = `
          <div class="mt-4 p-3 bg-red-50 rounded-xl border border-red-200 flex items-center gap-3">
            <div class="h-10 w-10 bg-red-100 rounded-full flex items-center justify-center shrink-0">
              <span class="material-symbols-outlined text-red-600">account_balance_wallet</span>
            </div>
            <div class="flex flex-col">
              <span class="text-sm font-bold text-red-800 leading-tight">Pedido Cancelado</span>
              <span class="text-xs text-red-700 mt-0.5">El reembolso de tu pago en Stripe ha sido procesado exitosamente.</span>
            </div>
          </div>
        `;
      }
    } else if (pedido.metodoPago === 'Efectivo') {
      paymentWarningContainer.innerHTML = `
        <div class="mt-4 p-3 bg-yellow-50 rounded-xl border border-yellow-200 flex items-center gap-3">
          <div class="h-10 w-10 bg-yellow-100 rounded-full flex items-center justify-center shrink-0">
            <span class="material-symbols-outlined text-yellow-600">payments</span>
          </div>
          <div class="flex flex-col">
            <span class="text-sm font-bold text-yellow-800 leading-tight">Pago Pendiente</span>
            <span class="text-xs text-yellow-700 mt-0.5">Por favor paga en caja al recoger tu pedido.</span>
          </div>
        </div>
      `;
    } else {
      paymentWarningContainer.innerHTML = `
        <div class="mt-4 p-3 bg-green-50 rounded-xl border border-green-200 flex items-center gap-3">
          <div class="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center shrink-0">
            <span class="material-symbols-outlined text-green-600">check_circle</span>
          </div>
          <div class="flex flex-col">
            <span class="text-sm font-bold text-green-800 leading-tight">Pago Completado</span>
            <span class="text-xs text-green-700 mt-0.5">Pagado con Tarjeta (Stripe).</span>
          </div>
        </div>
      `;
    }
  }

  if (estado === 'cancelado') {
    if (statusTitle) { statusTitle.textContent = 'Pedido Cancelado'; statusTitle.className = 'text-3xl font-extrabold text-red-600 tracking-tight font-display'; }
    if (subtitle) subtitle.textContent = 'Este pedido ha sido cancelado';
    if (indicator) { indicator.classList.remove('text-plaza-green'); indicator.classList.add('text-primary'); indicator.style.strokeDashoffset = '283'; }
    if (iconContainer) iconContainer.innerHTML = '<span class="material-symbols-outlined text-8xl text-red-600 drop-shadow-sm">cancel</span>';
    if (timeBadge) timeBadge.innerHTML = '<span class="text-xs font-bold text-red-600">Cancelado</span>';
    if (orbitDot) { orbitDot.classList.remove('bg-plaza-green'); orbitDot.classList.add('bg-primary'); }
    const queueCard = document.getElementById('queue-card');
    if (queueCard) queueCard.style.display = 'none';
  } else if (estado === 'listo') {
    if (statusTitle) { statusTitle.textContent = '¡Pedido Listo!'; statusTitle.className = 'text-3xl font-extrabold tracking-tight font-display text-plaza-green'; }
    if (subtitle) subtitle.textContent = 'Recoge en ventanilla';
    if (indicator) { indicator.classList.remove('text-primary'); indicator.classList.add('text-plaza-green'); }
    if (iconContainer) iconContainer.innerHTML = '<span class="material-symbols-outlined text-8xl text-plaza-green drop-shadow-sm">check_circle</span>';
    if (timeBadge) timeBadge.innerHTML = '<span class="text-xs font-bold text-plaza-green">Ahora</span>';
    if (orbitDot) { orbitDot.classList.remove('bg-primary'); orbitDot.classList.add('bg-plaza-green'); }
    if (pulse1) { pulse1.classList.remove('bg-primary/5'); pulse1.classList.add('bg-plaza-green/10'); }
    if (pulse2) { pulse2.classList.remove('bg-primary/10'); pulse2.classList.add('bg-plaza-green/20'); }
    if (bgBlob) { bgBlob.classList.remove('from-primary/5'); bgBlob.classList.add('from-plaza-green/10'); }
    if (ticketAccent) { ticketAccent.classList.remove('via-primary'); ticketAccent.classList.add('via-plaza-green'); }
    if (itemCount) { itemCount.classList.remove('text-primary'); itemCount.classList.add('text-plaza-green'); }
    const queueCard = document.getElementById('queue-card');
    if (queueCard) queueCard.style.display = 'none';
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
  } else if (estado === 'preparando') {
    if (statusTitle) { statusTitle.textContent = 'Preparando...'; statusTitle.className = 'text-3xl font-extrabold text-plaza-text tracking-tight font-display'; }
    if (subtitle) subtitle.textContent = 'El chef está haciendo su magia';
    if (iconContainer) iconContainer.innerHTML = '<span class="material-symbols-outlined text-7xl text-primary drop-shadow-sm">skillet</span>';
  } else {
    if (statusTitle) { statusTitle.textContent = 'Pedido Recibido'; statusTitle.className = 'text-3xl font-extrabold text-plaza-text tracking-tight font-display'; }
    if (subtitle) subtitle.textContent = 'Tu pedido está en cola';
    if (iconContainer) iconContainer.innerHTML = '<span class="material-symbols-outlined text-7xl text-primary drop-shadow-sm">receipt_long</span>';
  }
}
