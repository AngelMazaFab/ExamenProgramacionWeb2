// ============================================================
// firebase-config.js
// Inicialización del SDK de Firebase v9 (modular, via CDN ESM).
// Exporta las instancias de Auth, Firestore y Storage para
// ser importadas por cualquier controlador de vista.
// ============================================================

import { initializeApp }       from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth }             from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore }        from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage }          from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

import { env } from "./env.js";

// Configuración real del proyecto examenprogramacionweb2
export const firebaseConfig = {
  apiKey:            env.FIREBASE_API_KEY,
  authDomain:        env.FIREBASE_AUTH_DOMAIN,
  projectId:         env.FIREBASE_PROJECT_ID,
  storageBucket:     env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.FIREBASE_MESSAGING_SENDER_ID,
  appId:             env.FIREBASE_APP_ID,
  measurementId:     env.FIREBASE_MEASUREMENT_ID
};

const app     = initializeApp(firebaseConfig);
export const auth    = getAuth(app);
export const db      = getFirestore(app);
// Firebase Storage: intentar con el bucket configurado
export const storage = getStorage(app, `gs://${env.FIREBASE_STORAGE_BUCKET}`);
