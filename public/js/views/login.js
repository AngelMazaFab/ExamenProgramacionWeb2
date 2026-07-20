// ============================================================
// views/login.js — Controlador de la página de Login (P-01)
// Maneja la autenticación con Firebase Auth (email/password).
// Si el login es exitoso, redirige al dashboard.
// ============================================================

import { auth, db } from "../firebase-config.js";
const security = { secretKey: "SIGEP_KEY_2026" }; // Mocked for fingerprint login
import {
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const formLogin = document.getElementById("form-login");
const msgLogin  = document.getElementById("msg-login");
const btnLogin  = document.getElementById("btn-login");
const btnLoginHuella = document.getElementById("btn-login-huella");

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

// ── LOGIN CON HUELLA DIGITAL (WebAuthn) ───────────────────────
if (btnLoginHuella) {
  btnLoginHuella.addEventListener("click", async () => {
    if (!window.PublicKeyCredential) {
      mostrarMsg("warning", "Tu navegador no soporta autenticación biométrica.");
      return;
    }

    msgLogin.innerHTML = "";
    
    try {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);
      const rpId = location.hostname === "127.0.0.1" ? "localhost" : location.hostname;

      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge: challenge,
          rpId: rpId,
          userVerification: "required",
          timeout: 60000
        }
      });

      if (assertion && assertion.id) {
        // Buscar las credenciales ofuscadas en el almacenamiento local del dispositivo
        const huellasLocales = JSON.parse(localStorage.getItem("sigep_huellas") || "{}");
        const datosLocales = huellasLocales[assertion.id];

        if (!datosLocales) {
          mostrarMsg("danger", "Huella reconocida, pero no está vinculada a ninguna cuenta en ESTE dispositivo.");
          return;
        }

        btnLoginHuella.disabled = true;
        btnLoginHuella.textContent = "Verificando...";
        
        const correo = datosLocales.correo;
        const rawP = atob(datosLocales.p);
        const prefix = security.secretKey + ":";
        const password = rawP.startsWith(prefix) ? rawP.substring(prefix.length) : rawP;

        // Autenticar en Firebase con las credenciales recuperadas
        const credencial = await signInWithEmailAndPassword(auth, correo, password);
        const uid = credencial.user.uid;
        
        // Verificar que el operador exista en Firestore
        const operadorSnap = await getDoc(doc(db, "operadores", uid));
        if (!operadorSnap.exists()) {
           mostrarMsg("danger", "Tu cuenta no tiene un perfil de operador válido.");
           await auth.signOut();
           btnLoginHuella.disabled = false;
           btnLoginHuella.textContent = "Iniciar con Huella Digital";
           return;
        }
        
        mostrarMsg("success", "Huella verificada. Acceso concedido...");
        setTimeout(() => { location.href = "/dashboard.html"; }, 800);
      }
    } catch (err) {
      console.error(err);
      if (err.name === "NotAllowedError") {
        mostrarMsg("warning", "Lectura de huella cancelada.");
      } else {
        mostrarMsg("danger", "Error al leer huella: " + err.message);
      }
      btnLoginHuella.disabled = false;
      btnLoginHuella.textContent = "Iniciar con Huella Digital";
    }
  });
}

