// ============================================================
// views/operadores.js — CRUD de Operadores (P-07)
// Crea, lee, actualiza y elimina operadores en Firestore.
// Al crear, también crea la cuenta en Firebase Auth.
// NOTA: La creación de usuarios en Auth desde el cliente
// requiere signOut + reSignIn, por lo que se usa la
// API REST de Firebase Admin (o una Cloud Function).
// Como alternativa segura: el super_admin crea el operador
// en Firestore con una contraseña temporal que el operador
// cambia en su primer login.
// ============================================================

import { db, auth, storage, firebaseConfig } from "../firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { security } from "../security.js";
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  createUserWithEmailAndPassword,
  fetchSignInMethodsForEmail
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// ── DOM ───────────────────────────────────────────────────────
const form        = document.getElementById("form-operador");
const msgDiv      = document.getElementById("msg-operadores");
const inputId     = document.getElementById("id_operador");
const btnGuardar  = document.getElementById("btn-guardar-operador");
const btnCancelar = document.getElementById("btn-cancelar-operador");
const tablaBody   = document.getElementById("tabla-operadores");

let modoEdicion = false;

// ── Utilidades ────────────────────────────────────────────────
function mostrarMsg(tipo, msg) {
  msgDiv.innerHTML = `<div class="alert alert-${tipo}">${msg}</div>`;
  setTimeout(() => { msgDiv.innerHTML = ""; }, 6000);
}

function limpiarForm() {
  form.reset();
  inputId.value = "";
  modoEdicion = false;
  btnGuardar.textContent    = "Guardar Operador";
  btnCancelar.style.display = "none";
  document.getElementById("password_operador").required = false;
}

async function subirFoto(file, path) {
  if (!file || file.size === 0) return null;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return await getDownloadURL(storageRef);
}

// ── Listado en tiempo real ────────────────────────────────────
document.addEventListener("sigep:auth-ready", () => {
  const q = query(collection(db, "operadores"), orderBy("apellidos"));
  onSnapshot(q, (snap) => {
    if (snap.empty) {
      tablaBody.innerHTML = '<tr><td colspan="8">No hay operadores registrados.</td></tr>';
      return;
    }
    tablaBody.innerHTML = snap.docs.map((d) => filaOperador(d.id, d.data())).join("");
    adjuntarBotonesTabla();
  });
});

function filaOperador(id, o) {
  const foto = o.foto_perfil_url
    ? `<img src="${o.foto_perfil_url}" alt="Foto perfil" width="48" height="48" style="object-fit:cover;border-radius:50%">`
    : `<div style="width:48px;height:48px;background:var(--asphalt-soft);border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:var(--font-display);color:var(--paint-yellow);font-size:1.1rem">${(o.nombres||"?")[0]}</div>`;

  return `
    <tr data-id="${id}">
      <td>${foto}</td>
      <td>${o.nombres || "—"}</td>
      <td>${o.apellidos || "—"}</td>
      <td>${o.cedula_identidad || "—"}</td>
      <td>${o.turno || "—"}</td>
      <td>${o.cargo || "—"}</td>
      <td>${o.rol || "operador"}</td>
      <td class="actions">
        <a href="#" class="btn-editar-op" data-id="${id}">Editar</a> ·
        <a href="#" class="btn-eliminar-op" data-id="${id}" style="color:var(--signal-red)">Eliminar</a>
      </td>
    </tr>`;
}

function adjuntarBotonesTabla() {
  document.querySelectorAll(".btn-editar-op").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      const snap = await getDoc(doc(db, "operadores", btn.dataset.id));
      if (!snap.exists()) return;
      const o = snap.data();

      inputId.value = btn.dataset.id;
      document.getElementById("nombres").value          = o.nombres || "";
      document.getElementById("apellidos").value        = o.apellidos || "";
      document.getElementById("cedula_identidad").value = o.cedula_identidad || "";
      document.getElementById("correo_operador").value  = o.correo || "";
      document.getElementById("turno").value            = o.turno || "matutino";
      document.getElementById("cargo").value            = o.cargo || "cajero";
      document.getElementById("rol").value              = o.rol   || "operador";
      document.getElementById("huella_digital_hash").value = o.huella_digital_hash || "";

      // Contraseña no requerida en edición
      document.getElementById("password_operador").required = false;
      modoEdicion = true;
      btnGuardar.textContent    = "Actualizar Operador";
      btnCancelar.style.display = "inline-block";
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  document.querySelectorAll(".btn-eliminar-op").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      if (window.SIGEP?.rol !== "super_admin") {
        mostrarMsg("danger", "Solo el Super Administrador puede eliminar operadores.");
        return;
      }
      if (btn.dataset.id === window.SIGEP?.user?.uid) {
        mostrarMsg("danger", "No puedes eliminar tu propia cuenta.");
        return;
      }
      if (!confirm("¿Eliminar este operador? Solo se eliminará de Firestore.")) return;
      try {
        await deleteDoc(doc(db, "operadores", btn.dataset.id));
        mostrarMsg("success", "Operador eliminado de Firestore.");
      } catch (err) {
        mostrarMsg("danger", `Error: ${err.message}`);
      }
    });
  });
}

// ── CREAR / ACTUALIZAR ────────────────────────────────────────
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  btnGuardar.disabled = true;

  const nombres   = document.getElementById("nombres").value.trim();
  const apellidos = document.getElementById("apellidos").value.trim();
  const correo    = document.getElementById("correo_operador").value.trim();
  const password  = document.getElementById("password_operador").value;
  const cedula    = document.getElementById("cedula_identidad").value.trim();
  const foto      = document.getElementById("foto_perfil_operador").files[0];

  if (!nombres || !apellidos || !correo) {
    mostrarMsg("warning", "Nombres, apellidos y correo son obligatorios.");
    btnGuardar.disabled = false;
    return;
  }

  try {
    const datos = {
      nombres, apellidos, cedula_identidad: cedula,
      correo,
      contraseña: btoa(security.secretKey + ":" + password),
      turno:             document.getElementById("turno").value,
      cargo:             document.getElementById("cargo").value,
      rol:               document.getElementById("rol").value,
      huella_digital_hash: document.getElementById("huella_digital_hash").value.trim(),
      activo:            true,
      actualizado_en:    new Date(),
    };

    if (modoEdicion && inputId.value) {
      // ── ACTUALIZAR en Firestore ──────────────────────────
      if (foto) {
        datos.foto_perfil_url = await subirFoto(foto, `operadores/${inputId.value}/perfil`);
      }
      await updateDoc(doc(db, "operadores", inputId.value), datos);
      mostrarMsg("success", `Operador ${nombres} ${apellidos} actualizado.`);

    } else {
      // ── CREAR: primero en Auth, luego en Firestore ───────
      if (!password || password.length < 6) {
        mostrarMsg("warning", "La contraseña debe tener mínimo 6 caracteres.");
        btnGuardar.disabled = false;
        return;
      }

      // Crear cuenta en Firebase Auth con app secundaria para no desloguear al admin
      const secondaryApp = initializeApp(firebaseConfig, "AppSecundaria" + Date.now());
      const secondaryAuth = getAuth(secondaryApp);
      const credencial = await createUserWithEmailAndPassword(secondaryAuth, correo, password);
      const nuevoUid   = credencial.user.uid;
      await secondaryAuth.signOut(); // Limpiamos la sesión secundaria

      // Subir foto de perfil
      if (foto) {
        datos.foto_perfil_url = await subirFoto(foto, `operadores/${nuevoUid}/perfil`);
      }

      datos.fecha_registro = new Date();

      // Guardar en Firestore con el UID como ID del documento
      await updateDoc(doc(db, "operadores", nuevoUid), datos).catch(async () => {
        // Si el doc no existe, crearlo
        const { setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
        await setDoc(doc(db, "operadores", nuevoUid), datos);
      });

      mostrarMsg("success", `Operador ${nombres} ${apellidos} creado. UID: ${nuevoUid.slice(0,8)}…`);
    }

    limpiarForm();
  } catch (err) {
    const mensajes = {
      "auth/email-already-in-use": "Ese correo ya tiene una cuenta registrada.",
      "auth/weak-password":        "La contraseña es demasiado débil.",
      "auth/invalid-email":        "El formato del correo no es válido.",
    };
    mostrarMsg("danger", mensajes[err.code] || `Error: ${err.message}`);
  } finally {
    btnGuardar.disabled = false;
  }
});

btnCancelar.addEventListener("click", limpiarForm);
