import {
  collection,
  addDoc,
  updateDoc,
  setDoc,
  doc,
  getDoc,
  getDocs,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  serverTimestamp,
  increment
} from "firebase/firestore";
import { db } from "./firebaseInit.js";

/**
 * Función utilitaria para sanitizar cadenas y neutralizar ataques XSS / inyecciones HTML
 * @param {string} str - Cadena de entrada
 * @returns {string} - Cadena sanitizada
 */
export const escaparHtml = (str) => {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

/**
 * Tarea 2.0: Obtener todos los productos del menú
 * Lee la colección 'productos' completa desde Firestore.
 * @returns {Promise<Array<Object>>} - Arreglo de productos con su ID de documento
 */
export const obtenerMenu = async () => {
  try {
    const productosRef = collection(db, "productos");
    const snapshot = await getDocs(productosRef);
    const productos = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return productos;
  } catch (error) {
    console.error("Error obteniendo el menú: ", error);
    throw error;
  }
};

/**
 * Tarea 2.1: Enviar un nuevo pedido
 * @param {Object} datosPedido - Datos específicos del pedido (items, total, metodoPago)
 * @returns {Promise<string>} - Retorna el ID del documento del pedido recién creado
 */
export const enviarPedido = async (datosPedido) => {
  try {
    const docRef = await addDoc(collection(db, "pedidos"), {
      ...datosPedido,
      estado: datosPedido.estado || "nuevo", // Respetar estado proporcionado o usar 'nuevo' por defecto
      timestamp: serverTimestamp() // Tiempo de creación proporcionado por Firebase
    });

    // Decrementar stock
    if (datosPedido.items && datosPedido.items.length > 0) {
      const updatePromises = datosPedido.items.map(async (item) => {
        const productoRef = doc(db, "productos", item.id);
        try {
          const prodSnap = await getDoc(productoRef);
          if (prodSnap.exists()) {
            const currentStock = prodSnap.data().stock !== undefined ? prodSnap.data().stock : (prodSnap.data().disponible !== false ? 10 : 0);
            const newStock = Math.max(0, currentStock - item.cantidad);
            await setDoc(productoRef, { stock: newStock }, { merge: true });
          }
        } catch (err) {
          console.error(`❌ Error crítico: No se pudo restar stock de ${item.id}. Revisa las reglas de Firebase.`, err);
        }
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
 * @param {Function} callback - Función a ejecutar cuando los datos se actualicen
 * @returns {Function} - Función para detener la escucha cuando ya no sea necesaria
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
 * @param {string} id - ID del pedido en Firestore
 * @param {string} nuevoEstado - El nuevo estado a asignar
 */
export const actualizarEstadoPedido = async (id, nuevoEstado) => {
  try {
    const pedidoRef = doc(db, "pedidos", id);
    await updateDoc(pedidoRef, {
      estado: nuevoEstado
    });

  } catch (error) {
    console.error("Error actualizando estado del pedido: ", error);
    throw error;
  }
};

/**
 * Restaura el stock de los productos cuando se cancela un pedido
 * @param {Array<Object>} items - Array de items del pedido con id y cantidad
 */
export const restaurarStockPedido = async (items) => {
  if (!items || items.length === 0) return;
  try {
    const updatePromises = items.map(async (item) => {
      const productoRef = doc(db, "productos", item.id);
      try {
        const prodSnap = await getDoc(productoRef);
        if (prodSnap.exists()) {
          const currentStock = prodSnap.data().stock !== undefined ? prodSnap.data().stock : (prodSnap.data().disponible !== false ? 10 : 0);
          const newStock = currentStock + item.cantidad;
          await setDoc(productoRef, { stock: newStock }, { merge: true });

        }
      } catch (err) {
        console.error(`❌ Error restaurando stock de ${item.id}`, err);
      }
    });
    await Promise.all(updatePromises);
  } catch (error) {
    console.error("Error global al restaurar stock: ", error);
  }
};

/**
 * Tarea 2.4: Cambiar el stock numérico de un producto
 * @param {string} idProducto - ID del producto en Firestore
 * @param {number} cantidad - Nueva cantidad exacta de stock
 */
export const actualizarStock = async (idProducto, cantidad) => {
  try {
    const productoRef = doc(db, "productos", idProducto);
    // Usamos setDoc con merge para asegurar que el campo se cree si no existe
    await setDoc(productoRef, {
      stock: cantidad
    }, { merge: true });

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

/**
 * Tarea 2.7: Agregar un producto nuevo a la colección 'productos'
 * @param {Object} datosProducto - Data del producto (nombre, precio, stock, imagen, etc)
 * @returns {Promise<string>} - ID del nuevo producto
 */
export const agregarProducto = async (datosProducto) => {
  try {
    const docRef = await addDoc(collection(db, "productos"), {
      ...datosProducto,
      timestamp: serverTimestamp()
    });

    return docRef.id;
  } catch (error) {
    console.error("Error al agregar el producto: ", error);
    throw error;
  }
};

/**
 * Actualizar las propiedades de un producto existente en la colección 'productos'
 * @param {string} id - ID del documento del producto
 * @param {Object} camposActualizados - Propiedades a actualizar
 */
export const actualizarProducto = async (id, camposActualizados) => {
  try {
    const productoRef = doc(db, "productos", id);
    await updateDoc(productoRef, camposActualizados);

  } catch (error) {
    console.error("Error al actualizar el producto: ", error);
    throw error;
  }
};

/**
 * Eliminar un producto definitivamente de la colección 'productos'
 * @param {string} id - ID del documento del producto
 */
export const eliminarProducto = async (id) => {
  try {
    await deleteDoc(doc(db, "productos", id));

  } catch (error) {
    console.error("Error al eliminar el producto: ", error);
    throw error;
  }
};
