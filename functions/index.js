import { onRequest } from "firebase-functions/v2/https";
import Stripe from "stripe";
import cors from "cors";

// ============================================================
// Configuración
// ============================================================

// Stripe se inicializa con la variable de entorno desde functions/.env
const getStripe = () => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY no está configurada en las variables de entorno.");
  }
  return new Stripe(key);
};

// Middleware CORS - permite peticiones desde Firebase Hosting y localhost
const corsHandler = cors({
  origin: [
    "https://plazaflow-3045c.web.app",
    "https://plazaflow-3045c.firebaseapp.com",
    "http://localhost:3000",
    "http://localhost:5173",
  ],
});

// Helper: envolver handler con CORS + acceso público (no requiere autenticación)
const withCors = (handler) => {
  return onRequest({ region: "us-central1", invoker: "public" }, (req, res) => {
    corsHandler(req, res, () => handler(req, res));
  });
};

// ============================================================
// Cloud Function: Crear Sesión de Checkout (Backend Seguro)
// Esta función recibe el carrito y se comunica de servidor a servidor
// con Stripe para generar un link de pago único y cifrado.
// ============================================================
export const createCheckoutSession = withCors(async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  try {
    const stripe = getStripe();
    const { items, successUrl, cancelUrl, propina } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: "El carrito está vacío" });
    }

    // Convertir items de PlazaFlow al formato de Stripe
    const lineItems = items.map((item) => ({
      price_data: {
        currency: "mxn",
        product_data: {
          name: item.nombre,
          description: item.opcion ? `Opción: ${item.opcion}` : "Platillo",
        },
        unit_amount: Math.round(item.precio * 100),
      },
      quantity: item.cantidad,
    }));

    // Agregar propina si existe
    if (propina && propina > 0) {
      lineItems.push({
        price_data: {
          currency: "mxn",
          product_data: {
            name: "Propina del Equipo",
            description: "¡Gracias por apoyar a nuestro staff!",
          },
          unit_amount: Math.round(propina * 100),
        },
        quantity: 1,
      });
    }

    // Crear sesión de checkout
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
    });

    res.json({ id: session.id, url: session.url });
  } catch (error) {
    console.error("Error creando checkout session:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// Cloud Function: Verificar Sesión de Pago (Seguridad / Idempotencia)
// Verifica que el pago reportado en la URL del frontend sea legítimo
// preguntándole directamente a la API privada de Stripe.
// ============================================================
export const verifySession = withCors(async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  try {
    const stripe = getStripe();
    const { session_id } = req.query;

    if (!session_id) {
      return res.status(400).json({ error: "Falta el session_id" });
    }

    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.payment_status === "paid") {
      res.json({ success: true, session });
    } else {
      res.json({ success: false, session });
    }
  } catch (error) {
    console.error("Error verificando sesión:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// Cloud Function: Reembolsar Sesión de Pago (Refund Automático)
// Si un cliente cancela un pedido pagado con tarjeta, esta función
// solicita a Stripe la devolución automática del dinero a la tarjeta.
// ============================================================
export const refundSession = withCors(async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  try {
    const stripe = getStripe();
    const { session_id } = req.body;

    if (!session_id) {
      return res.status(400).json({ error: "Falta el session_id" });
    }

    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (!session.payment_intent) {
      return res.status(400).json({ error: "La sesión no tiene un pago capturado para reembolsar" });
    }

    const refund = await stripe.refunds.create({
      payment_intent: session.payment_intent,
    });

    res.json({ success: true, refund });
  } catch (error) {
    console.error("Error reembolsando sesión:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// Cloud Function: Health Check
// ============================================================
export const health = onRequest({ region: "us-central1", invoker: "public" }, (req, res) => {
  corsHandler(req, res, () => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      service: "PlazaFlow Stripe API",
    });
  });
});
