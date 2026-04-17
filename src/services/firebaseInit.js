import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDeiGqGyocZcq6wJ219zEv-qfOBlX7nx2U",
  authDomain: "plazaflow-3045c.firebaseapp.com",
  projectId: "plazaflow-3045c",
  storageBucket: "plazaflow-3045c.firebasestorage.app",
  messagingSenderId: "390492220261",
  appId: "1:390492220261:web:f60e3665185448170b8f8c",
  measurementId: "G-P2TS116QK3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
const db = getFirestore(app);

export { db, app };
