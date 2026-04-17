import { enviarPedido } from '../services/dbOperations.js';

// Tarea 3.1: Crear carrito global
window.carrito = [];

document.addEventListener('DOMContentLoaded', () => {
    // Tarea 3.2: Escuchar clics en los botones de añadir (.btn-add-item)
    const addButtons = document.querySelectorAll('.btn-add-item');
    
    addButtons.forEach(button => {
        button.addEventListener('click', (event) => {
            const card = event.target.closest('article');
            if (card) {
                const nombre = card.querySelector('.font-display').innerText;
                const precioText = card.querySelector('.font-heading').innerText;
                // Parse the price (e.g., "$12.00" -> 12.00)
                const precio = parseFloat(precioText.replace('$', ''));
                
                // Add to global cart
                window.carrito.push({ nombre, precio });
                console.log('Añadido al carrito:', { nombre, precio });
                console.log('Carrito actual:', window.carrito);
                
                // Update UI visually if ID exists (optional logic placeholder)
                const countBadge = document.getElementById('cart-item-count');
                const totalText = document.getElementById('cart-total-price');
                if (countBadge) countBadge.innerText = window.carrito.length;
                if (totalText) {
                    const total = window.carrito.reduce((acc, curr) => acc + curr.precio, 0);
                    totalText.innerText = `$${total.toFixed(2)}`;
                }
            }
        });
    });

    // Tarea 3.3: Checkout Button logic bindings (Pagar / Finalizar)
    // Here we bind to both potential "Pagar" buttons from cart and checkout
    const btnCheckoutCart = document.getElementById('btn-checkout-cart');
    const btnPayCheckout = document.getElementById('btn-pay-checkout');

    const handleCheckout = async () => {
        if (window.carrito.length === 0) {
            alert("El carrito está vacío.");
            return;
        }

        const total = window.carrito.reduce((acc, curr) => acc + curr.precio, 0);
        const datosPedido = {
            items: window.carrito,
            total: total,
            metodoPago: 'Digital' // Or dynamic from UI if mapped
        };

        try {
            const orderId = await enviarPedido(datosPedido);
            alert(`¡Pedido enviado exitosamente! ID: ${orderId}`);
            // Reset cart
            window.carrito = [];
        } catch (error) {
            alert("Error al enviar el pedido. Verifica la consola.");
            console.error(error);
        }
    };

    if (btnCheckoutCart) {
        btnCheckoutCart.addEventListener('click', handleCheckout);
    }
    
    // Using mouseup/touchend for the slide-to-pay functionality simply as click for now
    if (btnPayCheckout) {
        btnPayCheckout.addEventListener('click', handleCheckout);
    }
});
