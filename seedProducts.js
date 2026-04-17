import fs from 'fs';
import path from 'path';
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc } from "firebase/firestore";

// Leer el archivo .env puramente
const envFile = fs.readFileSync('.env', 'utf-8');
const envVars = {};
envFile.split('\n').forEach(line => {
    const index = line.indexOf('=');
    if (index > 0) {
        const key = line.substring(0, index).trim();
        const val = line.substring(index + 1).trim();
        envVars[key] = val;
    }
});

// Inicializar conexión nativa Node
const firebaseConfig = {
  apiKey: envVars.VITE_FIREBASE_API_KEY,
  authDomain: envVars.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: envVars.VITE_FIREBASE_PROJECT_ID,
  storageBucket: envVars.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: envVars.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: envVars.VITE_FIREBASE_APP_ID,
  measurementId: envVars.VITE_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const menuItems = [
    // Tacos ($30)
    { nombre: 'Taco de Carne Asada', categoria: 'Tacos', precio: 30, opciones: ['Harina', 'Maíz'] },
    { nombre: 'Taco de Carne Deshebrada', categoria: 'Tacos', precio: 30, opciones: ['Harina', 'Maíz'] },
    // Refrescos 600ml ($30)
    { nombre: 'Coca-Cola', categoria: 'Refrescos 600ml', precio: 30 },
    { nombre: 'Coca-Cola Light', categoria: 'Refrescos 600ml', precio: 30 },
    { nombre: 'Coca-Cola Zero', categoria: 'Refrescos 600ml', precio: 30 },
    { nombre: 'Fanta Fresa', categoria: 'Refrescos 600ml', precio: 30 },
    { nombre: 'Sprite', categoria: 'Refrescos 600ml', precio: 30 },
    // Otros Líquidos
    { nombre: 'Coca-Cola Lata', categoria: 'Otros Líquidos', precio: 20 },
    { nombre: 'Jugo Jumex Vidrio', categoria: 'Otros Líquidos', precio: 30 },
    // Sabritas ($20)
    { nombre: 'Tostitos', categoria: 'Sabritas', precio: 20 },
    { nombre: 'Doritos', categoria: 'Sabritas', precio: 20 },
    { nombre: 'Cheetos', categoria: 'Sabritas', precio: 20 },
    { nombre: 'Takis', categoria: 'Sabritas', precio: 20 },
    // Especialidades
    { nombre: 'Tostitos con Queso y Verdura', categoria: 'Especialidades', precio: 50 },
    { nombre: 'Tostitos con Carne Asada', categoria: 'Especialidades', precio: 90 }
];

async function seedDatabase() {
    console.log("Iniciando carga de la base de datos (Seeding)...");
    let exitosos = 0;
    
    for (const item of menuItems) {
        try {
            const docRef = await addDoc(collection(db, 'productos'), item);
            console.log(`✔️ Subido: ${item.nombre} (ID: ${docRef.id})`);
            exitosos++;
        } catch (error) {
            console.error(`\n❌ Error de Permiso/Conexión subiendo '${item.nombre}':`);
            console.error(error.message);
            console.error("-> Posible bloqueo de Firestore Security Rules ('allow write: if false;') detectado.\n");
            // Detenemos la ejecución al encontrar el primer error estructural (Reglas de Seguridad)
            break;
        }
    }
    
    if (exitosos === menuItems.length) {
        console.log(`\n✅ ¡Seeding completado! Se subieron ${exitosos} productos íntegramente.`);
    } else {
        console.log(`\n⚠️ Seeding interrumpido. Se subieron ${exitosos} de ${menuItems.length} productos.`);
    }
    process.exit();
}

seedDatabase();
