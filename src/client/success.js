import { enviarPedido } from '../services/dbOperations.js';

document.addEventListener('DOMContentLoaded', async () => {
    const loadingState = document.getElementById('loading-state');
    const successState = document.getElementById('success-state');
    const errorState = document.getElementById('error-state');
    const errorMessage = document.getElementById('error-message');

    function showError(msg) {
        loadingState.classList.add('hidden');
        successState.classList.add('hidden');
        errorState.classList.remove('hidden');
        if (msg) errorMessage.textContent = msg;
    }

    function showSuccess() {
        loadingState.classList.add('hidden');
        errorState.classList.add('hidden');
        successState.classList.remove('hidden');
    }

    try {
        const params = new URLSearchParams(window.location.search);
        const sessionId = params.get('session_id');

        if (!sessionId) {
            showError('No se encontró el ID de la sesión de pago.');
            return;
        }

        // 1. Verificar la sesión con nuestro backend
        const response = await fetch(`http://localhost:3005/verify-session?session_id=${sessionId}`);
        const data = await response.json();

        if (!data.success) {
            showError('El pago no ha sido completado o fue declinado.');
            return;
        }

        // 2. Si el pago fue exitoso, recuperar el carrito
        const carritoGuardado = localStorage.getItem('plazaflow_carrito');
        if (!carritoGuardado) {
            showError('No se encontraron artículos en el carrito para procesar el pedido.');
            return;
        }

        const carrito = JSON.parse(carritoGuardado);
        if (carrito.length === 0) {
            showError('El carrito está vacío.');
            return;
        }

        // 3. Crear el pedido en Firebase usando dbOperations
        // El subtotal y la propina ya se calcularon en app.js y Stripe, pero los recalculamos para el registro final.
        const subtotal = carrito.reduce((a, i) => a + (i.precio * i.cantidad), 0);
        // Stripe nos devuelve amount_total en centavos. Lo usamos para saber el total pagado.
        const totalPagado = (data.session.amount_total / 100);
        const propina = totalPagado - subtotal;

        const datosPedido = {
            items: carrito.map(i => ({ 
                id: i.id, 
                nombre: i.nombre, 
                precio: i.precio, 
                cantidad: i.cantidad, 
                opcion: i.opcionSeleccionada || null 
            })),
            subtotal: subtotal,
            propina: propina > 0 ? propina : 0,
            total: totalPagado,
            metodoPago: 'Tarjeta (Stripe)',
            stripeSessionId: sessionId
        };

        const orderId = await enviarPedido(datosPedido);

        // 4. Vaciar el carrito y mostrar éxito
        localStorage.removeItem('plazaflow_carrito');
        showSuccess();

        // 5. Redirigir a la vista de tracking
        setTimeout(() => {
            window.location.href = `tracking.html?orderId=${orderId}`;
        }, 2500);

    } catch (error) {
        console.error('Error procesando success:', error);
        showError('Ocurrió un error inesperado al procesar tu pedido. Si se realizó el cobro, acércate a mostrador con el ID: ' + (new URLSearchParams(window.location.search).get('session_id') || 'desconocido'));
    }
});
