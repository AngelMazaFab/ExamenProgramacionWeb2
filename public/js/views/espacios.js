// ============================================================
// views/espacios.js — CRUD de Espacios + Mapa Interactivo (P-05)
// Gestiona los espacios de estacionamiento en Firestore y
// muestra un mapa visual interactivo en tiempo real.
// ============================================================

import { db } from "../firebase-config.js";
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, getDocs, where, getDoc, limit
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ── Elementos DOM ─────────────────────────────────────────────
const form        = document.getElementById("form-espacio");
const msgDiv      = document.getElementById("msg-espacios");
const inputId     = document.getElementById("id_espacio");
const btnGuardar  = document.getElementById("btn-guardar-espacio");
const btnCancelar = document.getElementById("btn-cancelar-espacio");
const tablaBody   = document.getElementById("tabla-espacios");
const mapaDiv     = document.getElementById("mapa-espacios");
const selPiso     = document.getElementById("sel-piso");
const selSedeMapa = document.getElementById("sel-sede-mapa");
const selParq     = document.getElementById("id_parqueadero");

let modoEdicion  = false;
let todosEspacios = [];

// ── Funciones de utilidad ─────────────────────────────────────
function mostrarMsg(tipo, msg) {
  msgDiv.innerHTML = `<div class="alert alert-${tipo}">${msg}</div>`;
  setTimeout(() => { msgDiv.innerHTML = ""; }, 5000);
}

function limpiarForm() {
  form.reset();
  inputId.value = "";
  modoEdicion = false;
  btnGuardar.textContent    = "Guardar Espacio";
  btnCancelar.style.display = "none";
}

// ── Cargar sedes en el select ──────────────────────────────────
async function cargarSedes() {
  const snap = await getDocs(collection(db, "parqueaderos"));
  selParq.innerHTML     = '<option value="">— Seleccionar sede —</option>';
  selSedeMapa.innerHTML = '<option value="todos">Todas</option>';

  snap.forEach((d) => {
    const nombre = d.data().nombre || d.id;
    selParq.innerHTML     += `<option value="${d.id}">${nombre}</option>`;
    selSedeMapa.innerHTML += `<option value="${d.id}">${nombre}</option>`;
  });
}

// ── Clases CSS según estado ────────────────────────────────────
function clasePorEstado(estado) {
  const mapa = {
    disponible:    "espacio-slot--disponible",
    ocupado:       "espacio-slot--ocupado",
    mantenimiento: "espacio-slot--mantenimiento",
  };
  return mapa[estado?.toLowerCase()] || "espacio-slot--mantenimiento";
}

// ── Etiqueta HTML del estado ───────────────────────────────────
function etiquetaEstado(estado) {
  const mapa = {
    disponible:    "status--green",
    ocupado:       "status--red",
    mantenimiento: "",
  };
  const css = mapa[estado?.toLowerCase()] || "";
  return `<span class="status ${css}">${estado || "—"}</span>`;
}

// ── Nombres de sedes en caché ─────────────────────────────────
const nombreSedes = {};
async function obtenerNombreSede(id) {
  if (!id) return "—";
  if (nombreSedes[id]) return nombreSedes[id];
  const snap = await getDoc(doc(db, "parqueaderos", id));
  nombreSedes[id] = snap.exists() ? snap.data().nombre || id : id;
  return nombreSedes[id];
}

// ── Renderizar mapa y tabla ────────────────────────────────────
async function renderizarEspacios(espacios) {
  const filtroSede = selSedeMapa.value;
  const filtroPiso = selPiso.value;

  const filtrados = espacios.filter((e) => {
    const matchSede = filtroSede === "todos" || e.id_parqueadero === filtroSede;
    const matchPiso = filtroPiso === "todos"  || String(e.piso_nivel) === filtroPiso;
    return matchSede && matchPiso;
  });

  // ── Mapa ──────────────────────────────────────────────────
  mapaDiv.innerHTML = filtrados.length === 0
    ? "<p style='color:var(--steel)'>Sin espacios para mostrar.</p>"
    : filtrados.map((e) => `
        <div class="espacio-slot ${clasePorEstado(e.estado_actual)}"
             title="${e.codigo_identificador} — ${e.estado_actual}"
             data-id="${e._id}">
          ${e.codigo_identificador}
        </div>`).join("");

  // Clic en slot del mapa → cambiar estado rápidamente
  mapaDiv.querySelectorAll(".espacio-slot").forEach((slot) => {
    slot.addEventListener("click", async () => {
      const id = slot.dataset.id;
      const nuevoEstado = slot.classList.contains("espacio-slot--disponible")
        ? "ocupado"
        : slot.classList.contains("espacio-slot--ocupado")
        ? "mantenimiento"
        : "disponible";

      const rol = window.SIGEP?.rol;
      if (!["super_admin", "supervisor", "operador"].includes(rol)) return;
      try {
        await updateDoc(doc(db, "espacios", id), { estado_actual: nuevoEstado, actualizado_en: new Date() });
        await registrarAuditoria(`Cambio estado espacio`, `${slot.title} → ${nuevoEstado}`);
      } catch (err) {
        alert(`Error al cambiar estado: ${err.message}`);
      }
    });
  });

  // ── Tabla ─────────────────────────────────────────────────
  const filas = await Promise.all(filtrados.map(async (e) => {
    const sede = await obtenerNombreSede(e.id_parqueadero);
    return `
      <tr data-id="${e._id}">
        <td>${e.codigo_identificador || "—"}</td>
        <td>${sede}</td>
        <td>${e.tipo_espacio || "—"}</td>
        <td>${e.piso_nivel || "—"}</td>
        <td>${etiquetaEstado(e.estado_actual)}</td>
        <td class="actions">
          <a href="#" class="btn-editar-espacio" data-id="${e._id}">Editar</a> ·
          <a href="#" class="btn-eliminar-espacio" data-id="${e._id}" style="color:var(--signal-red)">Eliminar</a>
        </td>
      </tr>`;
  }));
  tablaBody.innerHTML = filas.join("") || '<tr><td colspan="6">Sin resultados.</td></tr>';
  adjuntarBotonesTabla();
}

// ── Actualizar opciones de piso en el filtro ──────────────────
function actualizarOpcionesPiso(espacios) {
  const pisos = [...new Set(espacios.map((e) => String(e.piso_nivel)).filter(Boolean))].sort();
  selPiso.innerHTML = '<option value="todos">Todos</option>';
  pisos.forEach((p) => { selPiso.innerHTML += `<option value="${p}">Piso ${p}</option>`; });
}

// ── Botones Editar/Eliminar de la tabla ───────────────────────
function adjuntarBotonesTabla() {
  document.querySelectorAll(".btn-editar-espacio").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      const espacio = todosEspacios.find((x) => x._id === btn.dataset.id);
      if (!espacio) return;

      inputId.value = espacio._id;
      document.getElementById("codigo_identificador").value = espacio.codigo_identificador || "";
      document.getElementById("tipo_espacio").value         = espacio.tipo_espacio          || "estandar";
      document.getElementById("piso_nivel").value           = espacio.piso_nivel            || "";
      document.getElementById("estado_actual").value        = espacio.estado_actual          || "disponible";
      selParq.value = espacio.id_parqueadero || "";

      modoEdicion = true;
      btnGuardar.textContent    = "Actualizar Espacio";
      btnCancelar.style.display = "inline-block";
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  document.querySelectorAll(".btn-eliminar-espacio").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      if (window.SIGEP?.rol !== "super_admin") {
        alert("Solo el Super Administrador puede eliminar espacios.");
        return;
      }
      if (!confirm("¿Eliminar este espacio?")) return;
      try {
        await deleteDoc(doc(db, "espacios", btn.dataset.id));
        mostrarMsg("success", "Espacio eliminado.");
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

  const codigo = document.getElementById("codigo_identificador").value.trim().toUpperCase();
  if (!codigo) {
    mostrarMsg("warning", "El código identificador es obligatorio.");
    btnGuardar.disabled = false;
    return;
  }

  const datos = {
    codigo_identificador: codigo,
    id_parqueadero:       selParq.value,
    tipo_espacio:         document.getElementById("tipo_espacio").value,
    piso_nivel:           document.getElementById("piso_nivel").value.trim(),
    estado_actual:        document.getElementById("estado_actual").value,
    actualizado_en:       new Date(),
  };

  try {
    if (modoEdicion && inputId.value) {
      await updateDoc(doc(db, "espacios", inputId.value), datos);
      mostrarMsg("success", `Espacio ${codigo} actualizado.`);
    } else {
      const qC = query(collection(db, "espacios"), where("codigo_identificador", "==", codigo), limit(1));
      const ex = await getDocs(qC);
      if (!ex.empty) {
        mostrarMsg("warning", `Ya existe un espacio con el código ${codigo}.`);
        btnGuardar.disabled = false;
        return;
      }
      await addDoc(collection(db, "espacios"), datos);
      mostrarMsg("success", `Espacio ${codigo} creado.`);
    }
    limpiarForm();
  } catch (err) {
    mostrarMsg("danger", `Error: ${err.message}`);
  } finally {
    btnGuardar.disabled = false;
  }
});

btnCancelar.addEventListener("click", limpiarForm);

// Filtros del mapa
selPiso.addEventListener("change",     () => renderizarEspacios(todosEspacios));
selSedeMapa.addEventListener("change", () => renderizarEspacios(todosEspacios));

// ── Registrar en auditoría ────────────────────────────────────
async function registrarAuditoria(accion, detalle) {
  try {
    await addDoc(collection(db, "auditoria"), {
      timestamp:       new Date(),
      uid_operador:    window.SIGEP?.user?.uid || "",
      nombre_operador: `${window.SIGEP?.perfil?.nombres || ""} ${window.SIGEP?.perfil?.apellidos || ""}`.trim(),
      accion:          "cambio_estado_espacio",
      detalle,
      ip_cliente:      "N/A",
      vista:           "espacios.html",
    });
  } catch (_) {}
}

// ── Arranque ──────────────────────────────────────────────────
document.addEventListener("sigep:auth-ready", async () => {
  await cargarSedes();

  const q = query(collection(db, "espacios"), orderBy("codigo_identificador"));
  onSnapshot(q, async (snap) => {
    todosEspacios = snap.docs.map((d) => ({ _id: d.id, ...d.data() }));
    actualizarOpcionesPiso(todosEspacios);
    await renderizarEspacios(todosEspacios);
  });
});
