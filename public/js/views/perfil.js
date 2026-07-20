// ============================================================
// views/perfil.js — Gestión del Perfil de Usuario (P-10)
// Carga los datos del operador desde Firestore, permite
// actualizar la foto de perfil en Storage y cambiar la
// contraseña en Firebase Auth.
// ============================================================

import { db, auth, storage } from "../firebase-config.js";
import {
  doc, getDoc, updateDoc, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  updatePassword, reauthenticateWithCredential,
  EmailAuthProvider
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// ── DOM ───────────────────────────────────────────────────────
const msgDiv = document.getElementById("msg-perfil");
const formFoto = document.getElementById("form-perfil");
const formPassword = document.getElementById("form-password");
const fotoPreview = document.getElementById("foto-perfil-preview");
const nombreDiv = document.getElementById("nombre-perfil");
const rolDiv = document.getElementById("rol-perfil");
const infoCorreo = document.getElementById("info-correo");
const infoTurno = document.getElementById("info-turno");
const infoCargo = document.getElementById("info-cargo");
const infoCedula = document.getElementById("info-cedula");
const infoFecha = document.getElementById("info-fecha");

function mostrarMsg(tipo, msg) {
  msgDiv.innerHTML = `<div class="alert alert-${tipo}">${msg}</div>`;
  setTimeout(() => { msgDiv.innerHTML = ""; }, 6000);
}

// ── Cargar datos del perfil ───────────────────────────────────
document.addEventListener("sigep:auth-ready", async ({ detail }) => {
  const { user, perfil } = detail;

  // Datos básicos desde el perfil en memoria (ya cargado por auth-guard)
  renderizarPerfil(perfil, user);
});

function renderizarPerfil(perfil, user) {
  const nombre = `${perfil.nombres || ""} ${perfil.apellidos || ""}`.trim();
  nombreDiv.textContent = nombre || "Sin nombre";
  rolDiv.textContent = `Rol: ${(perfil.rol || "operador").replace("_", " ").toUpperCase()}`;

  if (perfil.foto_perfil_url) {
    fotoPreview.src = perfil.foto_perfil_url;
  }

  infoCorreo.textContent = user.email || "—";
  infoTurno.textContent = perfil.turno || "—";
  infoCargo.textContent = perfil.cargo || "—";
  infoCedula.textContent = perfil.cedula_identidad || "—";

  if (perfil.fecha_registro?.toDate) {
    infoFecha.textContent = perfil.fecha_registro.toDate().toLocaleDateString("es-EC");
  } else {
    infoFecha.textContent = "—";
  }

  // Vista previa al seleccionar nueva foto
  document.getElementById("foto_nueva").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => { fotoPreview.src = ev.target.result; };
      reader.readAsDataURL(file);
    }
  });
}

// ── Actualizar foto de perfil ─────────────────────────────────
document.getElementById("btn-actualizar-foto").addEventListener("click", async (e) => {
  e.preventDefault();

  const btn = e.target;
  const originalText = btn.textContent;
  btn.textContent = "Subiendo...";
  btn.disabled = true;

  try {
    const file = document.getElementById("foto_nueva").files[0];
    if (!file) {
      mostrarMsg("warning", "Selecciona una imagen primero.");
      btn.textContent = originalText;
      btn.disabled = false;
      return;
    }

    const uid = window.SIGEP?.user?.uid;
    if (!uid) {
      mostrarMsg("danger", "No se pudo identificar el usuario. Intenta recargar la página.");
      btn.textContent = originalText;
      btn.disabled = false;
      return;
    }

    // Timeout de 20 segundos para detectar si Storage se cuelga
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Tiempo de espera agotado. Verifica tu conexión y los permisos de Firebase Storage.")), 20000)
    );

    const storageRef = ref(storage, `operadores/${uid}/perfil`);
    const url = await Promise.race([
      (async () => {
        await uploadBytes(storageRef, file);
        return await getDownloadURL(storageRef);
      })(),
      timeout
    ]);

    await setDoc(doc(db, "operadores", uid), { foto_perfil_url: url }, { merge: true });
    fotoPreview.src = url;
    mostrarMsg("success", "Foto de perfil actualizada correctamente.");
    formFoto.reset();
  } catch (err) {
    console.error("Error upload:", err);
    mostrarMsg("danger", `Error al subir foto: ${err.message}`);
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
});

// ── Cambiar contraseña ───────────────────────────────────────
formPassword.addEventListener("submit", async (e) => {
  e.preventDefault();
  const nueva = document.getElementById("password_nueva").value;
  const confirmar = document.getElementById("password_confirmar").value;

  if (!nueva || nueva.length < 6) {
    mostrarMsg("warning", "La contraseña debe tener mínimo 6 caracteres.");
    return;
  }
  if (nueva !== confirmar) {
    mostrarMsg("warning", "Las contraseñas no coinciden.");
    return;
  }

  try {
    await updatePassword(auth.currentUser, nueva);
    mostrarMsg("success", "Contraseña actualizada correctamente.");
    formPassword.reset();
  } catch (err) {
    // Firebase puede pedir re-autenticación reciente
    if (err.code === "auth/requires-recent-login") {
      mostrarMsg("warning", "Por seguridad, cierra sesión e inicia de nuevo antes de cambiar la contraseña.");
    } else {
      mostrarMsg("danger", `Error: ${err.message}`);
    }
  }
});
