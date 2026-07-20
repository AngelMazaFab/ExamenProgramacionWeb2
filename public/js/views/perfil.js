// ============================================================
// views/perfil.js — Gestión del Perfil de Usuario (P-10)
// Carga los datos del operador desde Firestore, permite
// actualizar la foto de perfil (guardada como Base64 en
// Firestore) y cambiar la contraseña en Firebase Auth.
// ============================================================

import { db, auth } from "../firebase-config.js";
import { inicializarCamara } from "../camera-widget.js";

// ── Inicializar cámara para foto de perfil ───────────────────
inicializarCamara("foto_nueva", "foto-perfil-preview");

import {
  doc, getDoc, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  updatePassword, reauthenticateWithCredential,
  EmailAuthProvider
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

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

/**
 * Convierte un File a un string Base64 (data URL).
 * Se redimensiona a max 200x200 px para no exceder el límite
 * de 1 MB por documento en Firestore.
 */
function fileToBase64(file, maxSize = 200) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("El archivo no es una imagen válida."));
      img.onload = () => {
        // Redimensionar con canvas
        const canvas = document.createElement("canvas");
        let w = img.width;
        let h = img.height;
        if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
        else       { w = Math.round(w * maxSize / h); h = maxSize; }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
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

// ── Actualizar foto de perfil (Base64 → Firestore) ───────────
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

    // Validar tamaño (máx 5 MB antes de comprimir)
    if (file.size > 5 * 1024 * 1024) {
      mostrarMsg("warning", "La imagen es demasiado grande. Máximo 5 MB.");
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

    // Convertir imagen a Base64 (redimensionada a 200x200 max)
    const base64Url = await fileToBase64(file);

    // Guardar directamente en Firestore (sin Firebase Storage)
    await setDoc(doc(db, "operadores", uid), { foto_perfil_url: base64Url }, { merge: true });

    fotoPreview.src = base64Url;
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
