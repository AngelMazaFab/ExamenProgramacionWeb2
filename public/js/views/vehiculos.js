// ============================================================
// views/vehiculos.js — CRUD de Vehículos (P-04)
// Crea, lee, actualiza y elimina vehículos en Firestore.
// Sube fotos del propietario y de la placa a Firebase Storage.
// ============================================================

import { db } from "../firebase-config.js";
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, where, getDocs, limit
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { inicializarCamara } from "../camera-widget.js";

// ── Elementos del DOM ─────────────────────────────────────────
const form          = document.getElementById("form-vehiculo");
const msgDiv        = document.getElementById("msg-vehiculos");
const inputId       = document.getElementById("id_vehiculo");
const btnGuardar    = document.getElementById("btn-guardar-vehiculo");
const btnCancelar   = document.getElementById("btn-cancelar-vehiculo");
const tablaBody     = document.getElementById("tabla-vehiculos");

let modoEdicion = false;

// ── Utilidades ────────────────────────────────────────────────
function mostrarMsg(tipo, msg) {
  msgDiv.innerHTML = `<div class="alert alert-${tipo}">${msg}</div>`;
  setTimeout(() => { msgDiv.innerHTML = ""; }, 5000);
}

function limpiarForm() {
  form.reset();
  inputId.value = "";
  modoEdicion = false;
  btnGuardar.textContent = "Guardar Vehículo";
  btnCancelar.style.display = "none";
}

/**
 * Convierte un File a Base64 (redimensionado a max 300px).
 */
async function fileToBase64(file, maxSize = 300) {
  if (!file || file.size === 0) return null;
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("El archivo no es una imagen válida."));
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width, h = img.height;
        if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
        else       { w = Math.round(w * maxSize / h); h = maxSize; }
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// ── Inicializar cámaras para foto propietario y foto placa ───
inicializarCamara("foto_propietario");
inicializarCamara("foto_placa");

// ── LEER: escucha en tiempo real la colección vehiculos ───────
document.addEventListener("sigep:auth-ready", () => {
  const q = query(collection(db, "vehiculos"), orderBy("placa"));
  onSnapshot(q, (snap) => {
    if (snap.empty) {
      tablaBody.innerHTML = '<tr><td colspan="8">No hay vehículos registrados.</td></tr>';
      return;
    }
    tablaBody.innerHTML = snap.docs.map((d) => filaVehiculo(d.id, d.data())).join("");
    // Re-adjuntar listeners de los botones de la tabla
    adjuntarBotonesTabla();
  });
});

/** Genera el HTML de una fila en la tabla de vehículos */
function filaVehiculo(id, v) {
  const fotoP = v.foto_propietario_url
    ? `<img src="${v.foto_propietario_url}" alt="Foto propietario" width="48" height="48" style="object-fit:cover;border-radius:50%">`
    : "—";
  const fotoPl = v.foto_placa_url
    ? `<img src="${v.foto_placa_url}" alt="Foto placa" width="64" height="40" style="object-fit:cover">`
    : "—";

  return `
    <tr data-id="${id}">
      <td>${v.placa || "—"}</td>
      <td>${v.marca || "—"}</td>
      <td>${v.modelo || "—"}</td>
      <td>${v.color || "—"}</td>
      <td>${v.nombre_propietario || "—"}</td>
      <td>${fotoP}</td>
      <td>${fotoPl}</td>
      <td class="actions">
        <a href="#" class="btn-editar-vehiculo" data-id="${id}">Editar</a> ·
        <a href="#" class="btn-eliminar-vehiculo" data-id="${id}" style="color:var(--signal-red)">Eliminar</a>
      </td>
    </tr>`;
}

/** Adjunta los eventos a los botones de la tabla tras cada render */
function adjuntarBotonesTabla() {
  // Editar
  document.querySelectorAll(".btn-editar-vehiculo").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      const id = btn.dataset.id;
      const row = document.querySelector(`tr[data-id="${id}"]`);
      if (!row) return;
      // Poblar el formulario con los datos de la fila (leemos desde Firestore para datos completos)
      const snap = await getDocs(query(collection(db, "vehiculos"), where("__name__", "==", id)));
      // Usar document directamente
      const { getDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
      const docSnap = await getDoc(doc(db, "vehiculos", id));
      if (!docSnap.exists()) return;
      const v = docSnap.data();

      inputId.value                                = id;
      document.getElementById("placa").value       = v.placa || "";
      document.getElementById("marca").value       = v.marca || "";
      document.getElementById("modelo").value      = v.modelo || "";
      document.getElementById("color").value       = v.color || "";
      document.getElementById("sexo_propietario").value = v.sexo_propietario || "";
      document.getElementById("nombre_propietario").value = v.nombre_propietario || "";
      document.getElementById("telefono_contacto").value  = v.telefono_contacto  || "";
      document.getElementById("correo_opcional").value    = v.correo_opcional     || "";

      modoEdicion = true;
      btnGuardar.textContent    = "Actualizar Vehículo";
      btnCancelar.style.display = "inline-block";
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  // Eliminar
  document.querySelectorAll(".btn-eliminar-vehiculo").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      const id = btn.dataset.id;
      const rol = window.SIGEP?.rol;
      if (rol !== "super_admin") {
        mostrarMsg("danger", "Solo el Super Administrador puede eliminar vehículos.");
        return;
      }
      if (!confirm("¿Eliminar este vehículo? Esta acción no se puede deshacer.")) return;
      try {
        await deleteDoc(doc(db, "vehiculos", id));
        mostrarMsg("success", "Vehículo eliminado correctamente.");
      } catch (err) {
        mostrarMsg("danger", `Error al eliminar: ${err.message}`);
      }
    });
  });
}

// ── CREAR / ACTUALIZAR ────────────────────────────────────────
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  btnGuardar.disabled = true;

  const placa = document.getElementById("placa").value.trim().toUpperCase();
  if (!placa) {
    mostrarMsg("warning", "La placa es obligatoria.");
    btnGuardar.disabled = false;
    return;
  }

  try {
    const fileFotoProp  = document.getElementById("foto_propietario").files[0];
    const fileFotoPlaca = document.getElementById("foto_placa").files[0];

    const datos = {
      placa,
      marca:              document.getElementById("marca").value.trim(),
      modelo:             document.getElementById("modelo").value.trim(),
      color:              document.getElementById("color").value.trim(),
      sexo_propietario:   document.getElementById("sexo_propietario").value,
      nombre_propietario: document.getElementById("nombre_propietario").value.trim(),
      telefono_contacto:  document.getElementById("telefono_contacto").value.trim(),
      correo_opcional:    document.getElementById("correo_opcional").value.trim(),
      actualizado_en:     new Date(),
    };

    if (modoEdicion && inputId.value) {
      // ── ACTUALIZAR ────────────────────────────────────────
      const vehiculoRef = doc(db, "vehiculos", inputId.value);

      if (fileFotoProp) {
        datos.foto_propietario_url = await fileToBase64(fileFotoProp);
      }
      if (fileFotoPlaca) {
        datos.foto_placa_url = await fileToBase64(fileFotoPlaca);
      }

      await updateDoc(vehiculoRef, datos);
      mostrarMsg("success", `Vehículo ${placa} actualizado correctamente.`);

    } else {
      // ── CREAR ──────────────────────────────────────────────
      // Verificar que la placa no exista ya
      const qPlaca = query(collection(db, "vehiculos"), where("placa", "==", placa), limit(1));
      const existente = await getDocs(qPlaca);
      if (!existente.empty) {
        mostrarMsg("warning", `Ya existe un vehículo con la placa ${placa}.`);
        btnGuardar.disabled = false;
        return;
      }

      datos.fecha_creacion   = new Date();
      datos.creado_por_uid   = window.SIGEP?.user?.uid || "";

      // Convertir fotos a Base64 antes de guardar
      if (fileFotoProp) {
        datos.foto_propietario_url = await fileToBase64(fileFotoProp);
      }
      if (fileFotoPlaca) {
        datos.foto_placa_url = await fileToBase64(fileFotoPlaca);
      }

      await addDoc(collection(db, "vehiculos"), datos);

      mostrarMsg("success", `Vehículo ${placa} registrado con éxito.`);
    }

    limpiarForm();
  } catch (err) {
    console.error("vehiculos.js error:", err);
    mostrarMsg("danger", `Error: ${err.message}`);
  } finally {
    btnGuardar.disabled = false;
  }
});

// ── Cancelar edición ─────────────────────────────────────────
btnCancelar.addEventListener("click", limpiarForm);
