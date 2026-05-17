import { enviarPedido } from '../services/dbOperations.js';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebaseInit.js';

document.addEventListener('DOMContentLoaded', async () => {
    // UI Elements
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
        // 1. Obtener parámetros de Stripe de la URL
        const params = new URLSearchParams(window.location.search);
        const sessionId = params.get('session_id');

        if (!sessionId) {
            showError('No se encontró el ID de la sesión de pago.');
            return;
        }

        // 2. Comprobación de IDEMPOTENCIA (Crucial para evitar pedidos duplicados)
        // Buscamos en Firebase si este session_id ya fue procesado antes (ej. si el cliente recarga la página)
        const existingQuery = query(
            collection(db, 'pedidos'),
            where('stripeSessionId', '==', sessionId)
        );
        const existingSnap = await getDocs(existingQuery);
        if (!existingSnap.empty) {
            // Ya existe un pedido con este sessionId, redirigir directamente al tracking
            const existingOrderId = existingSnap.docs[0].id;
            showSuccess();
            setTimeout(() => {
                window.location.href = `/tracking?orderId=${existingOrderId}`;
            }, 1500);
            return;
        }

        // 3. Verificación Segura con el Backend (Cloud Function)
        // No confiamos solo en la URL, le preguntamos al servidor de Stripe si la sesión realmente se pagó.
        const verifyUrl = import.meta.env.VITE_VERIFY_URL || 'http://localhost:3005/verify-session';
        const response = await fetch(`${verifyUrl}?session_id=${sessionId}`);
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

        // 4. Inserción en la Base de Datos (Firestore)
        // Si el pago es legítimo, recuperamos el carrito de memoria y guardamos el pedido.
        const subtotal = carrito.reduce((a, i) => a + (i.precio * i.cantidad), 0);
        const totalPagado = (data.session.amount_total / 100);
        const propina = totalPagado - subtotal;

        const clienteNombre = localStorage.getItem('plazaflow_cliente_nombre') || 'Cliente Local';

        const datosPedido = {
            clienteNombre,
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
            window.location.href = `/tracking?orderId=${orderId}`;
        }, 2500);

    } catch (error) {
        console.error('Error procesando success:', error);
        showError('Ocurrió un error inesperado al procesar tu pedido. Si se realizó el cobro, acércate a mostrador con el ID: ' + (new URLSearchParams(window.location.search).get('session_id') || 'desconocido'));
    }
});

