// ============================================================
// views/login.js — Controlador de la página de Login (P-01)
// Maneja la autenticación con Firebase Auth (email/password).
// Si el login es exitoso, redirige al dashboard.
// ============================================================

import { auth, db } from "../firebase-config.js";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const formLogin = document.getElementById("form-login");
const msgLogin  = document.getElementById("msg-login");
const btnLogin  = document.getElementById("btn-login");

// Si el usuario ya está autenticado, redirigir al dashboard
onAuthStateChanged(auth, (user) => {
  if (user) location.href = "/dashboard.html";
});

/**
 * Muestra un mensaje de alerta en el formulario de login.
 * @param {string} tipo    - 'success' | 'danger' | 'warning' | 'info'
 * @param {string} mensaje - Texto del mensaje
 */
function mostrarMsg(tipo, mensaje) {
  msgLogin.innerHTML = `<div class="alert alert-${tipo}">${mensaje}</div>`;
}

formLogin.addEventListener("submit", async (e) => {
  e.preventDefault();
  msgLogin.innerHTML = "";

  const correo   = document.getElementById("correo").value.trim();
  const password = document.getElementById("password").value;

  if (!correo || !password) {
    mostrarMsg("warning", "Por favor completa todos los campos.");
    return;
  }

  btnLogin.disabled = true;
  btnLogin.textContent = "Verificando...";

  try {
    const credencial = await signInWithEmailAndPassword(auth, correo, password);
    const uid = credencial.user.uid;

    // Verificar que el operador exista en Firestore
    const operadorSnap = await getDoc(doc(db, "operadores", uid));
    if (!operadorSnap.exists()) {
      mostrarMsg("danger", "Tu cuenta no tiene un perfil de operador. Contacta al administrador.");
      await auth.signOut();
      btnLogin.disabled = false;
      btnLogin.textContent = "Ingresar";
      return;
    }

    mostrarMsg("success", "Acceso concedido. Redirigiendo...");
    setTimeout(() => { location.href = "/dashboard.html"; }, 800);

  } catch (err) {
    // Mapear códigos de error de Firebase a mensajes amigables
    const mensajes = {
      "auth/user-not-found":    "No existe una cuenta con ese correo.",
      "auth/wrong-password":    "Contraseña incorrecta.",
      "auth/invalid-email":     "El correo no tiene un formato válido.",
      "auth/invalid-credential": "Correo o contraseña incorrectos.",
      "auth/too-many-requests": "Demasiados intentos. Intenta más tarde.",
    };
    const msg = mensajes[err.code] || `Error: ${err.message}`;
    mostrarMsg("danger", msg);
    btnLogin.disabled = false;
    btnLogin.textContent = "Ingresar";
  }
});
