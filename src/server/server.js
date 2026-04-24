import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Stripe from 'stripe';
import path from 'path';
import { fileURLToPath } from 'url';

// Cargar variables de entorno desde .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const PORT = process.env.PORT || 3005;

// Middlewares
app.use(cors());
app.use(express.json());

// ============================================================
// Endpoint: Crear Sesión de Checkout
// ============================================================
app.post('/create-checkout-session', async (req, res) => {
  try {
    const { items, successUrl, cancelUrl } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'El carrito está vacío' });
    }

    // Convertir items de PlazaFlow al formato de Stripe
    const lineItems = items.map(item => {
      return {
        price_data: {
          currency: 'mxn', // Pesos Mexicanos
          product_data: {
            name: item.nombre,
            description: item.opcion ? `Opción: ${item.opcion}` : 'Platillo',
            // images: [item.imagen], // Opcional
          },
          unit_amount: Math.round(item.precio * 100), // Stripe usa centavos (ej: 50.00 MXN = 5000)
        },
        quantity: item.cantidad,
      };
    });

    if (req.body.propina && req.body.propina > 0) {
      lineItems.push({
        price_data: {
          currency: 'mxn',
          product_data: {
            name: 'Propina del Equipo',
            description: '¡Gracias por apoyar a nuestro staff!',
          },
          unit_amount: Math.round(req.body.propina * 100),
        },
        quantity: 1,
      });
    }

    // Crear sesión
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
    });

    res.json({ id: session.id, url: session.url });
  } catch (error) {
    console.error('Error creando checkout session:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// Endpoint: Verificar Sesión
// ============================================================
app.get('/verify-session', async (req, res) => {
  try {
    const { session_id } = req.query;
    
    if (!session_id) {
      return res.status(400).json({ error: 'Falta el session_id' });
    }

    const session = await stripe.checkout.sessions.retrieve(session_id);
    
    // Verificar si el pago fue exitoso
    if (session.payment_status === 'paid') {
      res.json({ success: true, session });
    } else {
      res.json({ success: false, session });
    }
  } catch (error) {
    console.error('Error verificando sesión:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor de Stripe iniciado en http://localhost:${PORT}`);
});
