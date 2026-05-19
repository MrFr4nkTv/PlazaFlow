import { auth, storage } from '../services/firebaseInit.js';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { obtenerMenu, actualizarStock, escucharPedidos, escucharPedidoIndividual, actualizarEstadoPedido, restaurarStockPedido, escaparHtml, agregarProducto, actualizarProducto, eliminarProducto } from '../services/dbOperations.js';

// ============================================================
// AUTH GUARD — Proteger páginas admin
// ============================================================
const PUBLIC_PAGES = ['login.html', '/login'];
let authReady = false;

function esPublica() {
  return PUBLIC_PAGES.some(p => window.location.pathname.endsWith(p));
}

function verificarAuth() {
  onAuthStateChanged(auth, (user) => {
    authReady = true;
    if (user) {
      console.log('✅ Admin autenticado:', user.email);
      if (esPublica()) {
        window.location.href = '/cocina';
      }
    } else {
      console.log('🔒 No autenticado');
      if (!esPublica()) {
        // Solo redirigir si estamos seguros de que auth está configurado
        // (no redirigir en el primer load si auth no está habilitado)
        window.location.href = '/login';
      }
    }
  });

  // Logout listener
  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      try {
        await signOut(auth);
      } catch (error) {
        console.error('Error signing out:', error);
      }
    });
  }
}

// ============================================================
// LOGIN
// ============================================================
function inicializarLogin() {
  const btnEntrar = document.getElementById('btn-login');
  if (!btnEntrar) return;

  const emailInput = document.getElementById('email');
  const passInput = document.getElementById('password');
  const toggleBtn = document.getElementById('btn-toggle-pass');

  // Toggle password visibility
  if (toggleBtn) {
    toggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isPass = passInput.type === 'password';
      passInput.type = isPass ? 'text' : 'password';
      toggleBtn.querySelector('.material-symbols-outlined').textContent = isPass ? 'visibility_off' : 'visibility';
    });
  }

  btnEntrar.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    const password = passInput.value;

    if (!email || !password) {
      mostrarError('Ingresa email y contraseña');
      return;
    }

    btnEntrar.disabled = true;
    btnEntrar.innerHTML = '<span class="material-symbols-outlined animate-spin text-xl">sync</span> Entrando...';

    try {
      await signInWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged redirigirá a kds.html
    } catch (error) {
      console.error('Error login:', error);
      let msg = 'Error de autenticación';
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') msg = 'Email o contraseña incorrectos';
      if (error.code === 'auth/too-many-requests') msg = 'Demasiados intentos. Espera un momento.';
      mostrarError(msg);
      btnEntrar.disabled = false;
      btnEntrar.innerHTML = '<span>Entrar</span><span class="material-symbols-outlined text-xl">arrow_forward</span>';
    }
  });

  // Enter key
  passInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') btnEntrar.click(); });
}

function mostrarError(msg) {
  let errorEl = document.getElementById('login-error');
  if (!errorEl) {
    errorEl = document.createElement('div');
    errorEl.id = 'login-error';
    errorEl.className = 'text-center text-sm font-bold text-red-500 bg-red-50 py-2 px-4 rounded-xl mt-3';
    document.querySelector('form')?.appendChild(errorEl);
  }
  errorEl.textContent = msg;
  setTimeout(() => { errorEl.textContent = ''; }, 4000);
}

// ============================================================
// STOCK — Toggle disponibilidad
// ============================================================
function inicializarStock() {
  const stockList = document.getElementById('admin-stock-list');
  if (!stockList) return;

  cargarProductosStock();
  inicializarModalAgregarProducto();
}

function inicializarModalAgregarProducto() {
  const modal = document.getElementById('modal-add-product');
  const btnOpen = document.getElementById('btn-open-add-modal');
  const btnClose = document.getElementById('btn-close-add-modal');
  const form = document.getElementById('form-add-product');
  const uploadZone = document.getElementById('upload-zone');
  const fileInput = document.getElementById('add-imagen');
  const previewImg = document.getElementById('upload-preview');
  const placeholder = document.getElementById('upload-placeholder');
  const btnSubmit = document.getElementById('btn-submit-product');
  const titleEl = document.getElementById('modal-product-title');

  if (!modal || !btnOpen) return;

  let archivoSeleccionado = null;
  let modoEdicionId = null;
  let imagenPreviaUrl = null;

  const abrirModal = () => {
    modal.classList.remove('opacity-0', 'pointer-events-none');
    modal.querySelector('.bg-white').classList.remove('scale-95');
    modal.querySelector('.bg-white').classList.add('scale-100');
  };

  const cerrarModal = () => {
    modal.classList.add('opacity-0', 'pointer-events-none');
    modal.querySelector('.bg-white').classList.add('scale-95');
    modal.querySelector('.bg-white').classList.remove('scale-100');
    // Limpiar formulario
    if (form) form.reset();
    archivoSeleccionado = null;
    modoEdicionId = null;
    imagenPreviaUrl = null;
    if (previewImg) {
      previewImg.src = '';
      previewImg.classList.add('hidden');
    }
    if (placeholder) placeholder.classList.remove('hidden');
    if (titleEl) titleEl.textContent = 'Nuevo Producto';
    if (btnSubmit) btnSubmit.innerHTML = '<span class="material-symbols-outlined text-lg">check</span> Guardar en Menú';
  };

  btnOpen.addEventListener('click', () => {
    cerrarModal(); // Asegurar estado limpio
    setTimeout(() => {
      abrirModal();
    }, 10);
  });

  window.abrirModalEdicion = (producto) => {
    cerrarModal();
    modoEdicionId = producto.id;
    imagenPreviaUrl = producto.imagen || null;

    // Poblar campos
    const nombreInput = document.getElementById('add-nombre');
    const precioInput = document.getElementById('add-precio');
    const stockInput = document.getElementById('add-stock');
    const catInput = document.getElementById('add-categoria');
    const opcionesInput = document.getElementById('add-opciones');

    if (nombreInput) nombreInput.value = producto.nombre || '';
    if (precioInput) precioInput.value = producto.precio || '';
    if (stockInput) stockInput.value = producto.stock !== undefined ? producto.stock : (producto.disponible !== false ? 10 : 0);
    if (catInput && producto.categoria) catInput.value = producto.categoria;
    if (opcionesInput) opcionesInput.value = producto.opciones ? producto.opciones.join(', ') : '';

    if (titleEl) titleEl.textContent = 'Editar Producto';
    if (btnSubmit) btnSubmit.innerHTML = '<span class="material-symbols-outlined text-lg">update</span> Actualizar Producto';

    if (imagenPreviaUrl) {
      if (previewImg) {
        previewImg.src = imagenPreviaUrl;
        previewImg.classList.remove('hidden');
      }
      if (placeholder) placeholder.classList.add('hidden');
    }

    setTimeout(() => {
      abrirModal();
    }, 10);
  };

  if (btnClose) btnClose.addEventListener('click', cerrarModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) cerrarModal();
  });

  // Previsualización de imagen nativa
  if (uploadZone && fileInput) {
    uploadZone.addEventListener('click', (e) => {
      if (e.target !== fileInput) {
        fileInput.click();
      }
    });
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        if (!file.type.startsWith('image/')) {
          alert('Por favor selecciona un archivo de imagen válido.');
          return;
        }
        if (file.size > 5 * 1024 * 1024) {
          alert('La imagen no debe superar los 5MB.');
          return;
        }
        archivoSeleccionado = file;
        const reader = new FileReader();
        reader.onload = (ev) => {
          if (previewImg) {
            previewImg.src = ev.target.result;
            previewImg.classList.remove('hidden');
          }
          if (placeholder) placeholder.classList.add('hidden');
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // Guardado o Actualización del Producto
  if (btnSubmit) {
    btnSubmit.addEventListener('click', async () => {
      const nombreInput = document.getElementById('add-nombre');
      const precioInput = document.getElementById('add-precio');
      const stockInput = document.getElementById('add-stock');
      const catInput = document.getElementById('add-categoria');
      const opcionesInput = document.getElementById('add-opciones');

      if (!nombreInput || !nombreInput.checkValidity() || !precioInput || !precioInput.checkValidity() || !stockInput || !stockInput.checkValidity()) {
        if (form) form.reportValidity();
        return;
      }

      const nombre = nombreInput.value.trim();
      const precio = parseFloat(precioInput.value);
      const stock = parseInt(stockInput.value);
      const categoria = catInput ? catInput.value : 'General';
      const opcionesRaw = opcionesInput ? opcionesInput.value.trim() : '';
      const opciones = opcionesRaw ? opcionesRaw.split(',').map(o => o.trim()).filter(o => o.length > 0) : [];

      btnSubmit.disabled = true;
      const textoOriginal = btnSubmit.innerHTML;
      btnSubmit.innerHTML = '<span class="material-symbols-outlined animate-spin text-lg">sync</span> Guardando...';

      try {
        let imageUrl = imagenPreviaUrl;
        if (archivoSeleccionado) {
          btnSubmit.innerHTML = '<span class="material-symbols-outlined animate-spin text-lg">sync</span> Subiendo foto...';
          const ext = archivoSeleccionado.name.split('.').pop();
          const fileName = `prod_${Date.now()}_${Math.floor(Math.random() * 1000)}.${ext}`;
          const storageRef = ref(storage, `productos/${fileName}`);
          await uploadBytes(storageRef, archivoSeleccionado);
          imageUrl = await getDownloadURL(storageRef);
        }

        const datosProducto = {
          nombre,
          precio,
          stock,
          categoria,
          disponible: stock > 0
        };

        if (opciones.length > 0) {
          datosProducto.opciones = opciones;
        } else {
          datosProducto.opciones = [];
        }

        if (imageUrl) {
          datosProducto.imagen = imageUrl;
        }

        if (modoEdicionId) {
          await actualizarProducto(modoEdicionId, datosProducto);
        } else {
          await manualCleanCacheAndAdd(datosProducto);
        }

        // Recargar inventario para mostrar los cambios
        await cargarProductosStock();
        cerrarModal();
      } catch (error) {
        console.error('Error al guardar/actualizar el producto:', error);
        alert('Ocurrió un error al procesar el producto. Revisa los permisos de escritura en la consola de Firebase.');
      } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = textoOriginal;
      }
    });
  }
}

async function manualCleanCacheAndAdd(datos) {
  await agregarProducto(datos);
}

let stockProductosCache = [];
let stockFiltroCat = 'Todo';

async function cargarProductosStock() {
  const stockList = document.getElementById('admin-stock-list');
  try {
    stockProductosCache = await obtenerMenu();
    renderizarStockVisual();

    // Filtros de categoría
    const catBtns = document.querySelectorAll('.cat-btn');
    catBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        catBtns.forEach(b => {
          b.classList.remove('bg-text-main', 'text-white');
          b.classList.add('bg-white', 'text-gray-600');
        });
        btn.classList.remove('bg-white', 'text-gray-600');
        btn.classList.add('bg-text-main', 'text-white');

        stockFiltroCat = btn.dataset.cat;
        renderizarStockVisual();
      });
    });

    const catContainer = document.getElementById('stock-category-filters');
    if (catContainer) {
      catContainer.addEventListener('wheel', (e) => {
        if (e.deltaY !== 0) {
          e.preventDefault();
          catContainer.scrollLeft += e.deltaY;
        }
      });
    }

    // Búsqueda en Stock
    const searchInput = document.getElementById('stock-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        renderizarStockVisual();
      });
    }

  } catch (error) {
    console.error('Error cargando stock:', error);
    if (stockList) stockList.innerHTML = '<div class="text-center py-12"><p class="text-gray-400">Error cargando productos</p></div>';
  }
}

function renderizarStockVisual() {
  const stockList = document.getElementById('admin-stock-list');
  if (!stockList) return;

  const searchInput = document.getElementById('stock-search-input');
  const term = searchInput ? searchInput.value.toLowerCase() : '';

  let filtrados = stockProductosCache;
  if (stockFiltroCat !== 'Todo') {
    filtrados = filtrados.filter(p => {
      const cat = p.categoria || 'General';
      if (stockFiltroCat === 'Platos Fuertes') return /taco|plato fuerte|comida|nacho|alimento|hamburguesa|burrito|orden/i.test(cat);
      if (stockFiltroCat === 'Especialidades') return /especialidad|tostito|preparado/i.test(cat);
      if (stockFiltroCat === 'Sabritas') return /sabrita|papa|botana|churrito/i.test(cat);
      if (stockFiltroCat === 'Bebidas') return /bebida|refresco|l[ií]quido|jugo|agua|coca|sprite|fanta|sidral|mirinda|pepsi|manzanita|jugo/i.test(cat);
      if (stockFiltroCat === 'Postres') return /postre|dulce|nieve|pastel/i.test(cat);
      return cat === stockFiltroCat;
    });
  }
  if (term) {
    filtrados = filtrados.filter(p => (p.nombre || '').toLowerCase().includes(term) || (p.categoria || '').toLowerCase().includes(term));
  }

  if (filtrados.length === 0) {
    stockList.innerHTML = '<div class="text-center py-12"><p class="text-gray-400">No hay productos que coincidan</p></div>';
    return;
  }

  const categorias = {};
  filtrados.forEach(p => {
    const cat = p.categoria || 'General';
    if (!categorias[cat]) categorias[cat] = [];
    categorias[cat].push(p);
  });

  stockList.innerHTML = Object.entries(categorias).map(([cat, items]) => `
    <section>
      <div class="flex items-center justify-between mb-3 mt-2">
        <h2 class="font-display font-bold text-lg text-gray-800">${cat}</h2>
        <span class="text-xs font-bold text-gray-400">${items.length} productos</span>
      </div>
      <div class="flex flex-col gap-3">
        ${items.map(p => crearFilaStock(p)).join('')}
      </div>
    </section>
  `).join('');

  // Vincular botones de stock
  stockList.querySelectorAll('.stock-minus').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const display = stockList.querySelector(`.stock-display[data-id="${id}"]`);
      let currentStock = parseInt(display.textContent);
      if (currentStock > 0) {
        const newState = currentStock - 1;
        display.textContent = newState;
        btn.disabled = true;
        try {
          await actualizarStock(id, newState);
          const prod = stockProductosCache.find(p => p.id === id);
          if (prod) prod.stock = newState;
          actualizarFilaUI(btn.closest('.bg-white'), newState);
        } catch (e) {
          console.error('Error actualizando stock:', e);
          display.textContent = currentStock; // revert on error
        }
        btn.disabled = false;
      }
    });
  });

  stockList.querySelectorAll('.stock-plus').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const display = stockList.querySelector(`.stock-display[data-id="${id}"]`);
      let currentStock = parseInt(display.textContent);
      const newState = currentStock + 1;
      display.textContent = newState;
      btn.disabled = true;
      try {
        await actualizarStock(id, newState);
        const prod = stockProductosCache.find(p => p.id === id);
        if (prod) prod.stock = newState;
        actualizarFilaUI(btn.closest('.bg-white'), newState);
      } catch (e) {
        console.error('Error actualizando stock:', e);
        display.textContent = currentStock; // revert on error
      }
      btn.disabled = false;
    });
  });

  // Vincular botón de editar
  stockList.querySelectorAll('.stock-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const prod = stockProductosCache.find(p => p.id === id);
      if (prod && typeof window.abrirModalEdicion === 'function') {
        window.abrirModalEdicion(prod);
      }
    });
  });

  // Vincular botón de eliminar definitivamente
  stockList.querySelectorAll('.stock-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (confirm('¿Estás totalmente seguro de eliminar este producto de forma definitiva? Desaparecerá del menú y del inventario.')) {
        const id = btn.dataset.id;
        btn.disabled = true;
        try {
          await eliminarProducto(id);
          // Remover del cache local y re-renderizar
          stockProductosCache = stockProductosCache.filter(p => p.id !== id);
          renderizarStockVisual();
        } catch (e) {
          console.error('Error eliminando producto:', e);
          alert('Error al eliminar el producto. Verifica los permisos.');
          btn.disabled = false;
        }
      }
    });
  });
}

function crearFilaStock(producto) {
  // Inicializamos a 10 si no existe y si antes estaba disponible (o default 10)
  let stock = producto.stock !== undefined ? producto.stock : (producto.disponible !== false ? 10 : 0);

  const nombreSanitizado = escaparHtml(producto.nombre || 'Producto');
  const catSanitizada = escaparHtml(producto.categoria || 'General');

  const emoji = {
    'Tacos': '🌮', 'Refrescos 600ml': '🥤', 'Sabritas': '🍿',
    'Otros Líquidos': '🧃', 'Bebidas': '🥤', 'General': '🍽️'
  }[producto.categoria] || '🍽️';

  const vistaPreviaArticulo = producto.imagen ?
    `<img src="${escaparHtml(producto.imagen)}" class="w-14 h-14 rounded-2xl object-cover shrink-0 shadow-sm" alt="${nombreSanitizado}" loading="lazy"/>` :
    `<div class="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center text-2xl shrink-0">${emoji}</div>`;

  return `
    <div class="bg-white p-3 sm:p-4 rounded-3xl shadow-soft flex flex-col sm:flex-row sm:items-center gap-3 justify-between ${stock <= 0 ? 'opacity-60 border-2 border-red-200' : 'border-2 border-transparent'}">
      <div class="flex items-center gap-3 w-full sm:w-auto flex-1 min-w-0">
        ${vistaPreviaArticulo}
        <div class="flex-1 min-w-0">
          <h3 class="font-display font-bold text-sm sm:text-base text-gray-800 leading-tight break-words">${nombreSanitizado}</h3>
          <p class="text-xs sm:text-sm text-gray-400 mt-0.5">${catSanitizada} · $${Number(producto.precio || 0).toFixed(2)}</p>
        </div>
      </div>
      <div class="flex items-center justify-end gap-1 sm:gap-1.5 w-full sm:w-auto shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-gray-100">
        <div class="flex items-center gap-1 bg-gray-50 rounded-2xl p-1 shrink-0">
          <button class="stock-minus w-8 h-8 flex items-center justify-center bg-white rounded-xl shadow-sm text-gray-500 hover:text-red-500 active:scale-90 transition-all" data-id="${producto.id}">
            <span class="material-symbols-outlined text-[18px]">remove</span>
          </button>
          <span class="stock-display w-6 text-center font-bold text-gray-800" data-id="${producto.id}">${stock}</span>
          <button class="stock-plus w-8 h-8 flex items-center justify-center bg-white rounded-xl shadow-sm text-gray-500 hover:text-green-500 active:scale-90 transition-all" data-id="${producto.id}">
            <span class="material-symbols-outlined text-[18px]">add</span>
          </button>
        </div>
        <button class="stock-edit w-9 h-9 flex items-center justify-center bg-amber-50 rounded-xl text-amber-600 hover:bg-amber-100 active:scale-90 transition-all ml-1 shadow-sm" data-id="${producto.id}" title="Editar Producto">
          <span class="material-symbols-outlined text-[18px]">edit</span>
        </button>
        <button class="stock-delete w-9 h-9 flex items-center justify-center bg-red-50 rounded-xl text-red-500 hover:bg-red-600 active:scale-90 transition-all ml-1 shadow-sm" data-id="${producto.id}" title="Eliminar definitivamente">
          <span class="material-symbols-outlined text-[18px]">delete_forever</span>
        </button>
      </div>
    </div>`;
}

function actualizarFilaUI(row, stock) {
  if (!row) return;
  if (stock <= 0) {
    row.classList.add('opacity-60', 'border-red-200');
    row.classList.remove('border-transparent');
  } else {
    row.classList.remove('opacity-60', 'border-red-200');
    row.classList.add('border-transparent');
  }
}

// ============================================================
// HISTORIAL — Pedidos completados
// ============================================================
function inicializarHistorial() {
  const historyList = document.getElementById('history-order-list');
  if (!historyList) return;

  let currentFilter = 'day'; // 'day', 'week', 'month', 'custom'

  const btnDay = document.getElementById('filter-day');
  const btnWeek = document.getElementById('filter-week');
  const btnMonth = document.getElementById('filter-month');
  const dateStartEl = document.getElementById('history-date-start');
  const dateEndEl = document.getElementById('history-date-end');
  const dateStartLabelEl = document.getElementById('history-date-start-label');
  const dateEndLabelEl = document.getElementById('history-date-end-label');
  const dateLabelEl = document.getElementById('history-date-label');

  function updateActiveFilterButton() {
    [btnDay, btnWeek, btnMonth].forEach(b => {
      if (b) b.classList.replace('bg-white', 'bg-transparent');
      if (b) b.classList.replace('text-primary', 'text-gray-400');
      if (b) b.classList.remove('shadow-sm', 'border-gray-100');
    });
    if (currentFilter !== 'custom') {
      const activeBtn = currentFilter === 'day' ? btnDay : (currentFilter === 'week' ? btnWeek : btnMonth);
      if (activeBtn) {
        activeBtn.classList.replace('bg-transparent', 'bg-white');
        activeBtn.classList.replace('text-gray-400', 'text-primary');
        activeBtn.classList.add('shadow-sm', 'border-gray-100');
      }
    }
  }

  function formatDateShort(date) {
    if (!date || isNaN(date.getTime())) return '--';
    return date.toLocaleDateString('es-MX', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function filterOrders(pedidos) {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let filtered = [];
    let startLabel = '';
    let endLabel = formatDateShort(now);
    let titleLabel = '';

    if (currentFilter === 'custom') {
      const startVal = dateStartEl ? dateStartEl.value : null;
      const endVal = dateEndEl ? dateEndEl.value : null;
      const customStart = startVal ? new Date(startVal + 'T00:00:00') : null;
      const customEnd = endVal ? new Date(endVal + 'T23:59:59') : null;

      filtered = pedidos.filter(p => {
        if (!p.timestamp) return false;
        const pt = p.timestamp.toMillis();
        let valid = true;
        if (customStart && pt < customStart.getTime()) valid = false;
        if (customEnd && pt > customEnd.getTime()) valid = false;
        return valid;
      });
      startLabel = customStart ? formatDateShort(customStart) : '--';
      endLabel = customEnd ? formatDateShort(customEnd) : '--';
      titleLabel = `Personalizado <span class="h-1.5 w-1.5 rounded-full bg-primary"></span>`;
    } else if (currentFilter === 'day') {
      filtered = pedidos.filter(p => {
        if (!p.timestamp) return false;
        return p.timestamp.toMillis() >= startOfDay.getTime();
      });
      startLabel = formatDateShort(now);
      titleLabel = `Hoy <span class="h-1.5 w-1.5 rounded-full bg-primary"></span>`;
    } else if (currentFilter === 'week') {
      const startOfWeek = new Date(startOfDay);
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay()); // Sunday as start
      filtered = pedidos.filter(p => {
        if (!p.timestamp) return false;
        return p.timestamp.toMillis() >= startOfWeek.getTime();
      });
      startLabel = formatDateShort(startOfWeek);
      titleLabel = `Esta Semana <span class="h-1.5 w-1.5 rounded-full bg-primary"></span>`;
    } else if (currentFilter === 'month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      filtered = pedidos.filter(p => {
        if (!p.timestamp) return false;
        return p.timestamp.toMillis() >= startOfMonth.getTime();
      });
      startLabel = formatDateShort(startOfMonth);
      titleLabel = `Este Mes <span class="h-1.5 w-1.5 rounded-full bg-primary"></span>`;
    }

    if (dateStartLabelEl) dateStartLabelEl.textContent = startLabel;
    if (dateEndLabelEl) dateEndLabelEl.textContent = endLabel;
    if (dateLabelEl) dateLabelEl.innerHTML = titleLabel;

    return filtered;
  }

  // Event Listeners for Filters
  if (btnDay) btnDay.addEventListener('click', () => { currentFilter = 'day'; updateActiveFilterButton(); renderHistory(); });
  if (btnWeek) btnWeek.addEventListener('click', () => { currentFilter = 'week'; updateActiveFilterButton(); renderHistory(); });
  if (btnMonth) btnMonth.addEventListener('click', () => { currentFilter = 'month'; updateActiveFilterButton(); renderHistory(); });

  if (dateStartEl && dateEndEl) {
    const today = new Date();
    const tzoffset = today.getTimezoneOffset() * 60000;
    const todayStr = (new Date(today - tzoffset)).toISOString().split('T')[0];
    dateStartEl.max = todayStr;
    dateEndEl.max = todayStr;

    dateStartEl.addEventListener('change', () => {
      currentFilter = 'custom';
      if (dateStartEl.value) {
        dateEndEl.min = dateStartEl.value;
        if (dateEndEl.value && dateEndEl.value < dateStartEl.value) {
          dateEndEl.value = dateStartEl.value;
        }
      }
      updateActiveFilterButton();
      renderHistory();
    });

    dateEndEl.addEventListener('change', () => {
      currentFilter = 'custom';
      if (dateEndEl.value) {
        dateStartEl.max = dateEndEl.value;
        if (dateStartEl.value && dateStartEl.value > dateEndEl.value) {
          dateStartEl.value = dateEndEl.value;
        }
      } else {
        dateStartEl.max = todayStr;
      }
      updateActiveFilterButton();
      renderHistory();
    });
  }

  // Print button
  const btnPrint = document.getElementById('btn-print-history');
  if (btnPrint) btnPrint.addEventListener('click', () => { window.print(); });

  let todosPedidos = [];
  let historyViewMode = 'completados'; // 'completados' | 'cancelados'

  // Toggle button
  const btnToggleType = document.getElementById('btn-toggle-history-type');
  const toggleIcon = document.getElementById('toggle-history-icon');
  const toggleLabel = document.getElementById('toggle-history-label');

  if (btnToggleType) {
    btnToggleType.addEventListener('click', () => {
      if (historyViewMode === 'completados') {
        historyViewMode = 'cancelados';
        toggleLabel.textContent = 'CANCELADOS';
        toggleIcon.textContent = 'cancel';
        btnToggleType.classList.remove('text-green-600', 'hover:border-green-200');
        btnToggleType.classList.add('text-red-500', 'hover:border-red-200');
      } else {
        historyViewMode = 'completados';
        toggleLabel.textContent = 'COMPLETADOS';
        toggleIcon.textContent = 'check_circle';
        btnToggleType.classList.remove('text-red-500', 'hover:border-red-200');
        btnToggleType.classList.add('text-green-600', 'hover:border-green-200');
      }
      renderHistory();
    });
  }

  escucharPedidos((pedidos) => {
    todosPedidos = pedidos;
    renderHistory();
  });

  function renderHistory() {
    const filtered = filterOrders(todosPedidos);
    let listaPedidos;

    if (historyViewMode === 'cancelados') {
      listaPedidos = filtered.filter(p => p.estado === 'cancelado');
    } else {
      listaPedidos = filtered.filter(p => p.estado === 'listo' || p.estado === 'entregado');
    }

    // Stats (siempre calculan sobre los completados del rango)
    const completadosParaStats = filtered.filter(p => p.estado === 'listo' || p.estado === 'entregado');
    const totalPedidos = completadosParaStats.length;
    const totalVentas = completadosParaStats.reduce((a, p) => a + (Number(p.total) || 0), 0);

    // Actualizar stats cards
    const statEls = document.querySelectorAll('.text-3xl.font-bold');
    if (statEls[0]) statEls[0].textContent = totalPedidos;
    if (statEls[1]) statEls[1].textContent = `$${totalVentas.toFixed(0)}`;

    if (listaPedidos.length === 0) {
      const emptyMsg = historyViewMode === 'cancelados' ? 'No hay pedidos cancelados' : 'No hay pedidos completados';
      const emptyIcon = historyViewMode === 'cancelados' ? 'block' : 'receipt_long';
      historyList.innerHTML = `
        <div class="text-center py-12 md:col-span-2">
          <span class="material-symbols-outlined text-5xl text-gray-200 mb-3 block">${emptyIcon}</span>
          <p class="font-display font-bold text-gray-300">${emptyMsg}</p>
        </div>`;
      return;
    }

    // Renderizar pedidos (más recientes primero)
    historyList.innerHTML = listaPedidos.reverse().map(p => {
      const dateObj = p.timestamp ? new Date(p.timestamp.toMillis()) : new Date();
      const hora = dateObj.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
      const fecha = currentFilter !== 'day' ? dateObj.toLocaleDateString('es-MX', { month: 'short', day: 'numeric' }) + ', ' : '';
      const items = p.items || [];
      const itemsText = escaparHtml(items.map(i => `${i.cantidad}× ${i.nombre}`).join(', '));
      const ticketId = escaparHtml(p.id.slice(-4).toUpperCase());

      if (p.estado === 'cancelado') {
        const metodo = p.metodoPago === 'Efectivo' ? 'Sin cargo' : 'Reembolsado';
        return `
        <div class="bg-white rounded-[24px] shadow-card border border-red-100 overflow-hidden hover:shadow-float transition-shadow">
          <div class="p-5 flex items-center justify-between">
            <div class="flex items-center gap-4">
              <div class="h-14 w-14 rounded-2xl bg-red-50 flex items-center justify-center">
                <span class="material-symbols-outlined text-red-400 text-[28px]">cancel</span>
              </div>
              <div class="flex flex-col min-w-0">
                <span class="font-display font-bold text-base text-gray-800">#${ticketId}</span>
                <span class="text-xs text-gray-400 truncate max-w-[180px]">${itemsText}</span>
                <span class="text-xs text-gray-300 mt-0.5">${fecha}${hora}</span>
              </div>
            </div>
            <div class="text-right">
              <span class="font-display font-bold text-lg text-gray-400 line-through">$${Number(p.total || 0).toFixed(2)}</span>
              <p class="text-[10px] text-red-500 font-bold">CANCELADO</p>
              <p class="text-[9px] text-red-400 font-medium">${metodo}</p>
            </div>
          </div>
        </div>`;
      }

      return `
        <div class="bg-white rounded-[24px] shadow-card border border-gray-100 overflow-hidden hover:shadow-float transition-shadow">
          <div class="p-5 flex items-center justify-between">
            <div class="flex items-center gap-4">
              <div class="h-14 w-14 rounded-2xl bg-green-50 flex items-center justify-center">
                <span class="material-symbols-outlined text-green-500 text-[28px]">check_circle</span>
              </div>
              <div class="flex flex-col min-w-0">
                <span class="font-display font-bold text-base text-gray-800">#${ticketId}</span>
                <span class="text-xs text-gray-400 truncate max-w-[180px]">${itemsText}</span>
                <span class="text-xs text-gray-300 mt-0.5">${fecha}${hora}</span>
              </div>
            </div>
            <div class="text-right">
              <span class="font-display font-bold text-lg text-gray-800">$${Number(p.total || 0).toFixed(2)}</span>
              <p class="text-[10px] text-green-500 font-bold">COMPLETADO</p>
            </div>
          </div>
        </div>`;
    }).join('');
  }

  updateActiveFilterButton();
}

// ============================================================
// ADMIN DETAIL — Detalle de pedido desde KDS
// ============================================================
// ============================================================

function inicializarAdminDetail() {
  const params = new URLSearchParams(window.location.search);
  const orderId = params.get('id');
  if (!orderId) return;

  const orderIdEl = document.getElementById('detail-order-id');
  const orderTimeEl = document.getElementById('detail-order-time');
  const orderStatusEl = document.getElementById('detail-order-status');
  const itemCountEl = document.getElementById('detail-item-count');
  const orderListEl = document.getElementById('admin-detail-list');
  const btnProcess = document.getElementById('btn-admin-process-order');
  const btnComplete = document.getElementById('btn-admin-complete-order');

  escucharPedidoIndividual(orderId, (pedido) => {
    if (!pedido) {
      if (orderListEl) orderListEl.innerHTML = '<p class="text-center text-gray-500 py-10">Pedido no encontrado</p>';
      return;
    }

    if (orderIdEl) {
      orderIdEl.innerHTML = `PEDIDO #${orderId.slice(-4).toUpperCase()}${pedido.clienteNombre ? `<span class="block text-sm font-bold text-primary mt-1">Cliente: ${escaparHtml(pedido.clienteNombre)}</span>` : ''}`;
    }

    if (orderTimeEl && pedido.timestamp) {
      orderTimeEl.textContent = new Date(pedido.timestamp.toMillis()).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    }

    if (orderStatusEl) {
      orderStatusEl.textContent = pedido.estado.charAt(0).toUpperCase() + pedido.estado.slice(1);
      orderStatusEl.className = `font-body text-sm font-bold ${pedido.estado === 'listo' ? 'text-green-500' : pedido.estado === 'preparando' ? 'text-orange-500' : pedido.estado === 'cancelado' ? 'text-red-500' : 'text-ink'}`;
    }

    const items = pedido.items || [];
    if (itemCountEl) itemCountEl.textContent = `${items.reduce((acc, i) => acc + i.cantidad, 0)} Artículos`;

    if (orderListEl) {
      const subtotal = pedido.subtotal || pedido.total || 0;
      const propina = pedido.propina || 0;
      const total = pedido.total || 0;

      let itemsHtml = items.map(item => `
        <div class="bg-paper rounded-2xl p-4 shadow-soft border border-black/5">
          <div class="flex justify-between items-start mb-1">
            <div class="flex items-center gap-3">
              <span class="bg-primary/10 text-primary font-bold text-sm h-8 w-8 rounded-lg flex items-center justify-center">${item.cantidad}x</span>
              <span class="font-display font-bold text-ink">${escaparHtml(item.nombre)}</span>
            </div>
            <span class="font-display font-bold text-ink">$${(item.precio * item.cantidad).toFixed(2)}</span>
          </div>
          ${item.opcion ? `<p class="text-sm text-muted ml-11">${escaparHtml(item.opcion)}</p>` : ''}
        </div>
      `).join('');

      itemsHtml += `
        <div class="px-4 py-4 mt-4 bg-white rounded-2xl border border-black/5 shadow-soft">
          <div class="flex justify-between items-center text-sm font-medium text-muted mb-1">
            <span>Subtotal</span>
            <span>$${subtotal.toFixed(2)}</span>
          </div>
          ${propina > 0 ? `
          <div class="flex justify-between items-center text-sm font-medium text-muted mb-3">
            <span>Propina</span>
            <span>$${propina.toFixed(2)}</span>
          </div>` : ''}
          <div class="border-t border-dashed border-gray-200 my-2"></div>
          <div class="flex justify-between items-center font-display font-bold text-2xl text-ink mt-2">
            <span>Total</span>
            <span>$${total.toFixed(2)}</span>
          </div>
          ${pedido.estado === 'cancelado' ? `
          <div class="mt-4 p-3 bg-red-50 rounded-xl border border-red-200 flex items-center gap-2">
            <span class="material-symbols-outlined text-red-600">block</span>
            <div class="flex flex-col">
              <span class="text-sm font-bold text-red-800">Pedido Cancelado</span>
              <span class="text-xs text-red-700">${pedido.metodoPago === 'Efectivo' ? 'Sin cargo al cliente.' : 'Reembolsado en Stripe.'}</span>
            </div>
          </div>
          ` : pedido.metodoPago === 'Efectivo' ? `
          <div class="mt-4 p-3 bg-yellow-50 rounded-xl border border-yellow-200 flex items-center gap-2">
            <span class="material-symbols-outlined text-yellow-600">payments</span>
            <div class="flex flex-col">
              <span class="text-sm font-bold text-yellow-800">Falta Pagar (Efectivo)</span>
              <span class="text-xs text-yellow-700">Cobrar en mostrador al entregar.</span>
            </div>
          </div>
          ` : `
          <div class="mt-4 p-3 bg-green-50 rounded-xl border border-green-200 flex items-center gap-2">
            <span class="material-symbols-outlined text-green-600">check_circle</span>
            <div class="flex flex-col">
              <span class="text-sm font-bold text-green-800">Pago Completado</span>
              <span class="text-xs text-green-700">Pagado con Tarjeta (Stripe).</span>
            </div>
          </div>
          `}
        </div>
      `;

      orderListEl.innerHTML = itemsHtml;
    }

    // Actualizar estado de botones
    const btnCancel = document.getElementById('btn-admin-cancel-order');
    if (btnCancel) {
      if (pedido.estado !== 'cancelado' && pedido.estado !== 'listo' && pedido.estado !== 'entregado') {
        btnCancel.classList.remove('opacity-50', 'pointer-events-none');
        btnCancel.onclick = async () => {
          if (confirm('¿Estás totalmente seguro de cancelar este pedido? Se notificará al cliente y se reembolsará el pago si usó tarjeta.')) {
            btnCancel.disabled = true;
            const originalHtml = btnCancel.innerHTML;
            btnCancel.innerHTML = '<span class="material-symbols-outlined animate-spin text-xl font-bold">sync</span><span class="font-display font-bold text-[11px] uppercase leading-none text-center">Cancelando</span>';

            try {
              if (pedido.stripeSessionId && pedido.metodoPago !== 'Efectivo') {
                try {
                  const refundUrl = import.meta.env.VITE_REFUND_URL || 'http://localhost:3005/refund-session';
                  const res = await fetch(refundUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ session_id: pedido.stripeSessionId })
                  });

                  if (!res.ok) {
                    console.warn(`Servidor de reembolso respondió con estado ${res.status}`);
                  } else {
                    const contentType = res.headers.get("content-type");
                    if (contentType && contentType.indexOf("application/json") !== -1) {
                      const data = await res.json();
                      if (!data.success) console.warn('Advertencia en reembolso:', data.error);
                    }
                  }
                } catch (refundErr) {
                  console.error('No se pudo conectar con el servidor de reembolsos de Stripe:', refundErr);
                  alert('Aviso: El pedido se marcará como cancelado, pero no se pudo contactar automáticamente al servidor de Stripe para el reembolso. Asegúrate de que el servidor Node (server.js) esté en ejecución y reiniciado.');
                }
              }
              await actualizarEstadoPedido(orderId, 'cancelado');
              if (pedido.items) {
                await restaurarStockPedido(pedido.items);
              }
              alert('Pedido cancelado exitosamente e inventario restaurado.');
            } catch (err) {
              console.error('Error cancelando pedido:', err);
              alert('Error al actualizar el estado del pedido en Firebase.');
            } finally {
              btnCancel.disabled = false;
              btnCancel.innerHTML = originalHtml;
            }
          }
        };
      } else {
        btnCancel.classList.add('opacity-50', 'pointer-events-none');
      }
    }
    if (btnProcess) {
      if (pedido.estado === 'nuevo' || pedido.estado === 'pago_pendiente') {
        btnProcess.classList.remove('opacity-50', 'pointer-events-none');
        btnProcess.querySelector('span:last-child').textContent = 'Empezar Preparación';
        btnProcess.onclick = () => actualizarEstadoPedido(orderId, 'preparando');
      } else {
        btnProcess.classList.add('opacity-50', 'pointer-events-none');
      }
    }
    if (btnComplete) {
      if (pedido.estado !== 'listo' && pedido.estado !== 'cancelado') {
        btnComplete.classList.remove('opacity-50', 'pointer-events-none');
        btnComplete.onclick = () => actualizarEstadoPedido(orderId, 'listo');
      } else {
        btnComplete.classList.add('opacity-50', 'pointer-events-none');
      }
    }
  });
}

// ============================================================
// NAV — Navegación entre páginas admin
// ============================================================
function configurarNavAdmin() {
  document.getElementById('nav-active-orders')?.addEventListener('click', () => { window.location.href = '/cocina'; });
  document.getElementById('nav-stock')?.addEventListener('click', () => { window.location.href = '/inventario'; });
  document.getElementById('nav-history')?.addEventListener('click', () => { window.location.href = '/historial'; });
}

// ============================================================
// INICIALIZACIÓN
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  verificarAuth();
  configurarNavAdmin();
  inicializarLogin();
  inicializarStock();
  inicializarHistorial();
  inicializarAdminDetail();
});
