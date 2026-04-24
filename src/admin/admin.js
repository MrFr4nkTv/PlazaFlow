import { auth } from '../services/firebaseInit.js';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { obtenerMenu, cambiarDisponibilidad, escucharPedidos } from '../services/dbOperations.js';

// ============================================================
// AUTH GUARD — Proteger páginas admin
// ============================================================
const PUBLIC_PAGES = ['login.html'];
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
        window.location.href = 'kds.html';
      }
    } else {
      console.log('🔒 No autenticado');
      if (!esPublica()) {
        // Solo redirigir si estamos seguros de que auth está configurado
        // (no redirigir en el primer load si auth no está habilitado)
        window.location.href = 'login.html';
      }
    }
  });
}

// ============================================================
// LOGIN
// ============================================================
function inicializarLogin() {
  const form = document.querySelector('form');
  const btnEntrar = form?.querySelector('button[type="button"]');
  if (!form || !btnEntrar) return;

  const emailInput = document.getElementById('email');
  const passInput = document.getElementById('password');

  // Toggle password visibility
  const toggleBtn = form.querySelector('button.absolute');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
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
}

async function cargarProductosStock() {
  const stockList = document.getElementById('admin-stock-list');
  try {
    const productos = await obtenerMenu();

    // Agrupar por categoría
    const categorias = {};
    productos.forEach(p => {
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

    // Vincular toggles
    stockList.querySelectorAll('.stock-toggle').forEach(toggle => {
      toggle.addEventListener('click', async () => {
        const id = toggle.dataset.id;
        const currentlyAvailable = toggle.dataset.available === 'true';
        const newState = !currentlyAvailable;

        toggle.disabled = true;
        try {
          await cambiarDisponibilidad(id, newState);
          toggle.dataset.available = String(newState);
          actualizarToggleUI(toggle, newState);
        } catch (e) {
          console.error('Error toggling:', e);
        }
        toggle.disabled = false;
      });
    });

  } catch (error) {
    console.error('Error cargando stock:', error);
    stockList.innerHTML = '<div class="text-center py-12"><p class="text-gray-400">Error cargando productos</p></div>';
  }
}

function crearFilaStock(producto) {
  const disponible = producto.disponible !== false; // default true
  const emoji = {
    'Tacos': '🌮', 'Refrescos 600ml': '🥤', 'Sabritas': '🍿',
    'Otros Líquidos': '🧃', 'Bebidas': '🥤', 'General': '🍽️'
  }[producto.categoria] || '🍽️';

  return `
    <div class="bg-white p-4 rounded-3xl shadow-soft flex items-center gap-4 ${!disponible ? 'opacity-60 border-2 border-red-200' : ''}">
      <div class="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center text-2xl shrink-0">${emoji}</div>
      <div class="flex-1 min-w-0">
        <h3 class="font-display font-bold text-base text-gray-800 truncate">${producto.nombre || 'Producto'}</h3>
        <p class="text-sm text-gray-400">${producto.categoria || 'General'} · $${Number(producto.precio || 0).toFixed(2)}</p>
      </div>
      <button class="stock-toggle relative w-14 h-8 rounded-full transition-colors duration-300 ${disponible ? 'bg-green-400' : 'bg-gray-300'}"
        data-id="${producto.id}" data-available="${disponible}">
        <span class="absolute top-1 ${disponible ? 'left-7' : 'left-1'} w-6 h-6 bg-white rounded-full shadow-md transition-all duration-300"></span>
      </button>
    </div>`;
}

function actualizarToggleUI(toggle, disponible) {
  const dot = toggle.querySelector('span');
  const row = toggle.closest('.bg-white');
  if (disponible) {
    toggle.classList.remove('bg-gray-300');
    toggle.classList.add('bg-green-400');
    dot.classList.remove('left-1');
    dot.classList.add('left-7');
    row?.classList.remove('opacity-60', 'border-2', 'border-red-200');
  } else {
    toggle.classList.remove('bg-green-400');
    toggle.classList.add('bg-gray-300');
    dot.classList.remove('left-7');
    dot.classList.add('left-1');
    row?.classList.add('opacity-60', 'border-2', 'border-red-200');
  }
}

// ============================================================
// HISTORIAL — Pedidos completados
// ============================================================
function inicializarHistorial() {
  const historyList = document.getElementById('history-order-list');
  if (!historyList) return;

  escucharPedidos((pedidos) => {
    const completados = pedidos.filter(p => p.estado === 'listo');

    // Stats
    const totalPedidos = completados.length;
    const totalVentas = completados.reduce((a, p) => a + (Number(p.total) || 0), 0);

    // Actualizar stats cards
    const statEls = document.querySelectorAll('.text-3xl.font-bold');
    if (statEls[0]) statEls[0].textContent = totalPedidos;
    if (statEls[1]) statEls[1].textContent = `$${totalVentas.toFixed(0)}`;

    if (completados.length === 0) {
      historyList.innerHTML = `
        <div class="text-center py-12">
          <span class="material-symbols-outlined text-5xl text-gray-200 mb-3 block">receipt_long</span>
          <p class="font-display font-bold text-gray-300">No hay pedidos completados</p>
        </div>`;
      return;
    }

    // Renderizar pedidos (más recientes primero)
    historyList.innerHTML = completados.reverse().map(p => {
      const hora = p.timestamp ? new Date(p.timestamp.toMillis()).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '--:--';
      const items = p.items || [];
      const itemsText = items.map(i => `${i.cantidad}× ${i.nombre}`).join(', ');
      const ticketId = p.id.slice(-4).toUpperCase();

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
                <span class="text-xs text-gray-300 mt-0.5">${hora}</span>
              </div>
            </div>
            <div class="text-right">
              <span class="font-display font-bold text-lg text-gray-800">$${Number(p.total || 0).toFixed(2)}</span>
              <p class="text-[10px] text-green-500 font-bold">COMPLETADO</p>
            </div>
          </div>
        </div>`;
    }).join('');
  });
}

// ============================================================
// NAV — Navegación entre páginas admin
// ============================================================
function configurarNavAdmin() {
  document.getElementById('nav-active-orders')?.addEventListener('click', () => { window.location.href = 'kds.html'; });
  document.getElementById('nav-stock')?.addEventListener('click', () => { window.location.href = 'stock.html'; });
  document.getElementById('nav-history')?.addEventListener('click', () => { window.location.href = 'history.html'; });
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
});
