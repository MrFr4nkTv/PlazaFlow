import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp 
} from "firebase/firestore";
import { db } from "./firebaseInit.js";

/**
 * Tarea 2.1: Enviar un nuevo pedido
 * @param {Object} datosPedido - Data specific to the order (items, total, metodoPago)
 * @returns {Promise<string>} - Returns the ID of the newly created order document
 */
export const enviarPedido = async (datosPedido) => {
  try {
    const docRef = await addDoc(collection(db, "pedidos"), {
      ...datosPedido,
      estado: "Nuevo", // Valor por defecto
      timestamp: serverTimestamp() // Tiempo de creación proporcionado por Firebase
    });
    console.log("Pedido creado con ID: ", docRef.id);
    return docRef.id;
  } catch (e) {
    console.error("Error añadiendo el pedido: ", e);
    throw e;
  }
};

/**
 * Tarea 2.2: Escuchar pedidos en tiempo real para el KDS
 * @param {Function} callback - Function to execute when data updates
 * @returns {Function} - Unsubscribe function to stop listening when no longer needed
 */
export const escucharPedidos = (callback) => {
  const q = query(collection(db, "pedidos"), orderBy("timestamp", "asc"));
  return onSnapshot(q, (snapshot) => {
    const pedidos = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(pedidos);
  }, (error) => {
    console.error("Error al escuchar pedidos: ", error);
  });
};

/**
 * Tarea 2.3: Actualizar el estado de un pedido (ej. de 'Nuevo' a 'Preparando')
 * @param {string} id - ID of the order in Firestore
 * @param {string} nuevoEstado - The new status
 */
export const actualizarEstadoPedido = async (id, nuevoEstado) => {
  try {
    const pedidoRef = doc(db, "pedidos", id);
    await updateDoc(pedidoRef, {
      estado: nuevoEstado
    });
    console.log(`Estado del pedido ${id} actualizado a ${nuevoEstado}`);
  } catch (error) {
    console.error("Error actualizando estado del pedido: ", error);
    throw error;
  }
};

/**
 * Tarea 2.4: Cambiar la disponibilidad de un producto ('Quick Sold-Out' / disponible)
 * @param {string} idProducto - ID of the product in Firestore
 * @param {boolean} disponible - true if available, false if sold out
 */
export const cambiarDisponibilidad = async (idProducto, disponible) => {
  try {
    const productoRef = doc(db, "productos", idProducto);
    await updateDoc(productoRef, {
      disponible: disponible
    });
    console.log(`Disponibilidad del producto ${idProducto} cambiada a ${disponible}`);
  } catch (error) {
    console.error("Error actualizando la disponibilidad del producto: ", error);
    throw error;
  }
};
