// 1. Importaciones de Firebase (Sintaxis Modular v9+)
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// 4. Lógica Core: Registrar un Ticket (Check-in)
async function registrarIngreso() {
    const placa = document.getElementById('placaInput').value.trim();
    const resultadoDiv = document.getElementById('resultado');

    if (!placa) {
        resultadoDiv.innerHTML = `<div class="alert alert-warning">Por favor, ingresa una placa.</div>`;
        return;
    }

    try {
        resultadoDiv.innerHTML = `<div class="alert alert-info">Guardando en base de datos...</div>`;
        
        // Creamos el documento en la colección 'Tickets'
        const docRef = await addDoc(collection(db, "Tickets"), {
            placa_vehiculo: placa,
            fecha_hora_ingreso: serverTimestamp(), // Hora exacta del servidor
            estado_ticket: "Activo" //
            // Nota: Para el MVP, omitiremos temporalmente el ID del espacio hasta que amarremos esa tabla[cite: 1]
        });

        resultadoDiv.innerHTML = `
            <div class="alert alert-success">
                <strong>¡Ingreso exitoso!</strong><br>
                Ticket ID: ${docRef.id}<br>
                Estado: Activo
            </div>`;
        
        // Limpiar el input
        document.getElementById('placaInput').value = '';

    } catch (error) {
        console.error("Error al guardar: ", error);
        resultadoDiv.innerHTML = `<div class="alert alert-danger">Error de conexión: ${error.message}</div>`;
    }
}

// 5. Conectar el botón
document.getElementById('btnIngreso').addEventListener('click', registrarIngreso);