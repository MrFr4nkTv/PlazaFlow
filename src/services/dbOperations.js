import { 
  collection, 
  addDoc, 
  updateDoc,
  setDoc,
  doc, 
  getDocs,
  onSnapshot, 
  query, 
  orderBy, 
  where,
  serverTimestamp,
  increment
} from "firebase/firestore";
import { db } from "./firebaseInit.js";

/**
 * Tarea 2.0: Obtener todos los productos del menú
 * Lee la colección 'productos' completa desde Firestore.
 * @returns {Promise<Array<Object>>} - Array de productos con su ID de documento
 */
export const obtenerMenu = async () => {
  try {
    const productosRef = collection(db, "productos");
    const snapshot = await getDocs(productosRef);
    const productos = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    console.log(`✔️ Menú obtenido: ${productos.length} productos`);
    return productos;
  } catch (error) {
    console.error("Error obteniendo el menú: ", error);
    throw error;
  }
};

/**
 * Tarea 2.1: Enviar un nuevo pedido
 * @param {Object} datosPedido - Data specific to the order (items, total, metodoPago)
 * @returns {Promise<string>} - Returns the ID of the newly created order document
 */
export const enviarPedido = async (datosPedido) => {
  try {
    const docRef = await addDoc(collection(db, "pedidos"), {
      ...datosPedido,
      estado: "nuevo", // Valor por defecto
      timestamp: serverTimestamp() // Tiempo de creación proporcionado por Firebase
    });
    console.log("Pedido creado con ID: ", docRef.id);

    // Decrementar stock
    if (datosPedido.items && datosPedido.items.length > 0) {
      const updatePromises = datosPedido.items.map(item => {
        const productoRef = doc(db, "productos", item.id);
        // Usamos setDoc con merge por si el campo 'stock' no existe aún
        return setDoc(productoRef, {
          stock: increment(-item.cantidad)
        }, { merge: true }).catch(err => {
          console.error(`❌ Error crítico: No se pudo restar stock de ${item.id}. Revisa las reglas de Firebase.`, err);
        });
      });
      await Promise.all(updatePromises);
    }

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
 * Tarea 2.4: Cambiar el stock numérico de un producto
 * @param {string} idProducto - ID of the product in Firestore
 * @param {number} cantidad - Nueva cantidad exacta de stock
 */
export const actualizarStock = async (idProducto, cantidad) => {
  try {
    const productoRef = doc(db, "productos", idProducto);
    // Usamos setDoc con merge para asegurar que el campo se cree si no existe
    await setDoc(productoRef, {
      stock: cantidad
    }, { merge: true });
    console.log(`Stock del producto ${idProducto} cambiado a ${cantidad}`);
  } catch (error) {
    console.error("Error actualizando el stock del producto: ", error);
    if (error.code === 'permission-denied') {
      alert("⚠️ Error de Firebase: No tienes permisos para modificar el inventario. Revisa las 'Rules' en tu consola de Firebase.");
    }
    throw error;
  }
};

/**
 * Tarea 2.5: Escuchar un pedido individual en tiempo real (para tracking)
 * @param {string} pedidoId - ID del pedido
 * @param {Function} callback - Función que recibe el pedido actualizado
 * @returns {Function} - Unsubscribe
 */
export const escucharPedidoIndividual = (pedidoId, callback) => {
  const pedidoRef = doc(db, "pedidos", pedidoId);
  return onSnapshot(pedidoRef, (snapshot) => {
    if (snapshot.exists()) {
      callback({ id: snapshot.id, ...snapshot.data() });
    }
  }, (error) => {
    console.error("Error escuchando pedido:", error);
  });
};

/**
 * Tarea 2.6: Escuchar la cola activa de pedidos en tiempo real
 * Retorna pedidos con estado 'nuevo' o 'preparando' ordenados por timestamp
 * @param {Function} callback - Recibe array de pedidos activos
 * @returns {Function} - Unsubscribe
 */
export const escucharColaActiva = (callback) => {
  const q = query(
    collection(db, "pedidos"),
    where("estado", "in", ["nuevo", "preparando"]),
    orderBy("timestamp", "asc")
  );
  return onSnapshot(q, (snapshot) => {
    const pedidos = snapshot.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));
    callback(pedidos);
  }, (error) => {
    console.error("Error escuchando cola activa:", error);
  });
};
