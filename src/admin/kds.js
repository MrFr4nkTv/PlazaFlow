import { escucharPedidos, actualizarEstadoPedido } from '../services/dbOperations.js';
import { auth } from '../services/firebaseInit.js';
import { onAuthStateChanged } from 'firebase/auth';

// ============================================================
// AUTH GUARD
// ============================================================
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = 'login.html';
  }
});

// ============================================================
// KDS - Kitchen Display System
// ============================================================

let filtroActual = 'nuevo';
let todosLosPedidos = [];

const estadoConfig = {
  nuevo:      { label: 'Nuevo',      color: 'bg-red-500',    icon: 'notifications_active', next: 'preparando' },
  preparando: { label: 'Preparando', color: 'bg-orange-500', icon: 'skillet',               next: 'listo' },
  listo:      { label: 'Listo',      color: 'bg-green-500',  icon: 'check_circle',          next: null },
};

function tiempoTranscurrido(timestamp) {
  if (!timestamp) return '...';
  const now = Date.now();
  const ms = now - timestamp.toMillis();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'Ahora';
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function crearTarjetaPedido(pedido) {
  const config = estadoConfig[pedido.estado] || estadoConfig.nuevo;
  const items = pedido.items || [];

  return `
  <article class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col relative" data-pedido-id="${pedido.id}">
    <div class="px-3 py-2 border-b border-gray-100 flex justify-between items-center ${config.color}/10">
      <div>
        <span class="font-display font-bold text-lg text-ink">#${pedido.id.slice(-4).toUpperCase()}</span>
        <p class="text-xs text-ink-light">${tiempoTranscurrido(pedido.timestamp)}</p>
      </div>
      <span class="px-2 py-1 rounded-full text-xs font-bold text-white ${config.color}">${config.label}</span>
    </div>
    <div class="p-3 flex-1">
      <ul class="space-y-1">
        ${items.map(item => `
          <li class="flex justify-between items-center text-sm">
            <span class="font-medium text-ink">${item.cantidad}\u00d7 ${item.nombre}${item.opcion ? ` (${item.opcion})` : ''}</span>
          </li>
        `).join('')}
      </ul>
      ${pedido.total ? `<p class="mt-2 text-xs font-bold text-ink-light border-t border-dashed border-gray-200 pt-2">Total: $${Number(pedido.total).toFixed(2)}</p>` : ''}
    </div>
    ${config.next ? `
    <button class="kds-advance w-full py-3 ${config.color} text-white font-display font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all"
      data-pedido-id="${pedido.id}" data-next-estado="${config.next}">
      <span class="material-symbols-outlined text-[18px]">${config.next === 'preparando' ? 'skillet' : 'check_circle'}</span>
      ${config.next === 'preparando' ? 'Empezar a Preparar' : 'Marcar como Listo'}
    </button>` : `
    <div class="w-full py-3 bg-green-50 text-green-600 font-display font-bold text-sm flex items-center justify-center gap-2">
      <span class="material-symbols-outlined text-[18px]">done_all</span> Entregado
    </div>`}
  </article>`;
}

function renderizarPedidos() {
  const grid = document.getElementById('kds-order-list');
  if (!grid) return;

  const filtrados = todosLosPedidos.filter(p => p.estado === filtroActual);

  if (filtrados.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full text-center py-16">
        <span class="material-symbols-outlined text-6xl text-gray-200 mb-4 block">inbox</span>
        <p class="font-display font-bold text-lg text-gray-300">No hay pedidos ${filtroActual === 'nuevo' ? 'nuevos' : filtroActual === 'preparando' ? 'en proceso' : 'listos'}</p>
      </div>`;
    return;
  }

  grid.innerHTML = filtrados.map(crearTarjetaPedido).join('');

  grid.querySelectorAll('.kds-advance').forEach(btn => {
    btn.addEventListener('click', async () => {
      const pedidoId = btn.dataset.pedidoId;
      const nextEstado = btn.dataset.nextEstado;
      btn.disabled = true;
      btn.innerHTML = '<span class="material-symbols-outlined animate-spin text-[18px]">sync</span> Actualizando...';
      try {
        await actualizarEstadoPedido(pedidoId, nextEstado);
      } catch (e) {
        console.error(e);
        btn.disabled = false;
      }
    });
  });
}

function actualizarContadores() {
  const counts = { nuevo: 0, preparando: 0, listo: 0 };
  todosLosPedidos.forEach(p => { if (counts[p.estado] !== undefined) counts[p.estado]++; });

  const tabs = document.querySelectorAll('.kds-tab');
  tabs.forEach(tab => {
    const estado = tab.dataset.estado;
    const badge = tab.querySelector('.kds-badge');
    if (badge) badge.textContent = counts[estado] || 0;
  });
}

function configurarTabs() {
  const tabContainer = document.getElementById('kds-tabs-container');
  if (!tabContainer) return;

  const estados = ['nuevo', 'preparando', 'listo'];
  const labels = ['Nuevos', 'En Proceso', 'Listos'];
  const icons = ['notifications_active', 'skillet', 'check_circle'];

  tabContainer.innerHTML = estados.map((est, i) => `
    <button class="kds-tab flex-1 h-12 rounded-xl flex items-center justify-center gap-2 transition-all ${est === filtroActual ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'text-gray-500 hover:bg-gray-50'}"
      data-estado="${est}">
      <span class="material-symbols-outlined text-[20px]">${icons[i]}</span>
      <span class="font-display text-base font-bold">${labels[i]}</span>
      <span class="kds-badge ${est === filtroActual ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-500'} text-xs font-bold px-2 py-0.5 rounded-full min-w-[24px]">0</span>
    </button>
  `).join('');

  tabContainer.querySelectorAll('.kds-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      filtroActual = tab.dataset.estado;
      tabContainer.querySelectorAll('.kds-tab').forEach(t => {
        t.classList.remove('bg-primary', 'text-white', 'shadow-lg', 'shadow-primary/30');
        t.classList.add('text-gray-500', 'hover:bg-gray-50');
        const b = t.querySelector('.kds-badge');
        if (b) { b.classList.remove('bg-white/25', 'text-white'); b.classList.add('bg-gray-100', 'text-gray-500'); }
      });
      tab.classList.remove('text-gray-500', 'hover:bg-gray-50');
      tab.classList.add('bg-primary', 'text-white', 'shadow-lg', 'shadow-primary/30');
      const badge = tab.querySelector('.kds-badge');
      if (badge) { badge.classList.remove('bg-gray-100', 'text-gray-500'); badge.classList.add('bg-white/25', 'text-white'); }
      renderizarPedidos();
    });
  });
}

// ============================================================
// NAV
// ============================================================
function configurarNavAdmin() {
  document.getElementById('nav-active-orders')?.addEventListener('click', () => { window.location.href = 'kds.html'; });
  document.getElementById('nav-stock')?.addEventListener('click', () => { window.location.href = 'stock.html'; });
  document.getElementById('nav-history')?.addEventListener('click', () => { window.location.href = 'history.html'; });
}

// ============================================================
// INICIALIZACI\u00d3N KDS
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  configurarTabs();
  configurarNavAdmin();

  escucharPedidos((pedidos) => {
    todosLosPedidos = pedidos;
    actualizarContadores();
    renderizarPedidos();
    console.log(`\ud83d\udd04 KDS: ${pedidos.length} pedidos actualizados`);
  });
});
