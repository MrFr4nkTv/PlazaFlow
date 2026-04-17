import { escucharPedidos, actualizarEstadoPedido } from '../services/dbOperations.js';

document.addEventListener('DOMContentLoaded', () => {
    const kdsListContainer = document.getElementById('kds-order-list');

    // Tarea 2.2: Renderizado de Kanban
    const renderizarTablero = (pedidos) => {
        if (!kdsListContainer) return;
        kdsListContainer.innerHTML = ''; // Limpia el contenedor actual

        // Clasificar los pedidos
        const agrupados = {
            nuevo: [],
            preparacion: [],
            listo: []
        };

        pedidos.forEach(pedido => {
            if (pedido.estado === 'nuevo') grouped = agrupados.nuevo;
            else if (pedido.estado === 'En Preparación') grouped = agrupados.preparacion;
            else if (pedido.estado === 'Listos') grouped = agrupados.listo;
            else return;

            // Template literal structure representing each KDS Card
            const cardHTML = `
                <div class="bg-surface rounded-xl p-4 shadow-sm border border-card-border mb-3" data-id="${pedido.id}">
                    <div class="flex justify-between items-start mb-3">
                        <div>
                            <span class="text-xs font-medium text-ink-light block">Pedido: ${pedido.id.slice(-6).toUpperCase()}</span>
                            <span class="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold bg-warning-light text-warning mt-1">
                                <span class="material-symbols-outlined text-[14px]">timer</span> ${pedido.estado}
                            </span>
                        </div>
                    </div>
                    <div class="space-y-2 mb-4 text-sm text-ink font-medium">
                        ${pedido.items ? pedido.items.map(item => `<p>1x - ${item.nombre}</p>`).join('') : '<p>Sin articulos detallados</p>'}
                    </div>
                    <div class="flex gap-2">
                        ${pedido.estado === 'nuevo' 
                            ? `<button class="btn-admin-process-order flex-1 bg-ink text-surface py-2 rounded-lg font-semibold text-sm hover:bg-ink-light transition-colors" data-id="${pedido.id}">Preparar</button>`
                            : ''
                        }
                        ${pedido.estado === 'En Preparación' 
                            ? `<button class="btn-admin-complete-order flex-1 bg-success text-surface py-2 rounded-lg font-semibold text-sm hover:opacity-90 transition-colors" data-id="${pedido.id}">Completar</button>`
                            : ''
                        }
                        ${pedido.estado === 'Listos' 
                            ? `<span class="flex-1 text-center text-success font-semibold text-sm py-2">Listo para entregar</span>`
                            : ''
                        }
                    </div>
                </div>
            `;
            
            kdsListContainer.insertAdjacentHTML('beforeend', cardHTML);
        });

        // Tarea 2.4: Lógica de interacción para los botones
        document.querySelectorAll('.btn-admin-process-order').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.getAttribute('data-id');
                await actualizarEstadoPedido(id, 'En Preparación');
            });
        });

        document.querySelectorAll('.btn-admin-complete-order').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.getAttribute('data-id');
                await actualizarEstadoPedido(id, 'Listos');
            });
        });
    };

    // Tarea 2.1: Iniciar la escucha en tiempo real
    if (kdsListContainer) {
        escucharPedidos(renderizarTablero);
    }
});
