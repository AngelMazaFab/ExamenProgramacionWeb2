// ============================================================
// views/auditoria.js — Bitácora de Auditoría (P-12)
// Lee la colección 'auditoria' de Firestore en tiempo real.
// Permite filtrar por acción y fecha, y exportar a Excel.
// ============================================================

import { db } from "../firebase-config.js";
import {
  collection, query, where, orderBy, onSnapshot,
  getDocs, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ── DOM ───────────────────────────────────────────────────────
const form = document.getElementById("form-filtro-auditoria");
const tablaBody = document.getElementById("tabla-auditoria");
const btnExportar = document.getElementById("btn-exportar-auditoria");
const selAccion = document.getElementById("filtro-accion-audit");
const inputFecha = document.getElementById("filtro-fecha-audit");

let registrosActuales = [];
let unsubscribe = null;

// ── Formatear fecha ────────────────────────────────────────────
function fmtFecha(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString("es-EC", { dateStyle: "short", timeStyle: "medium" });
}

// ── Cargar auditoría (con o sin filtros) ───────────────────────
function cargarAuditoria(accion = "todas", fechaDesde = null) {
  // Cancelar suscripción anterior si existe
  if (unsubscribe) unsubscribe();

  // Solo ordenamos por fecha en la consulta a Firestore
  const q = query(collection(db, "auditoria"), orderBy("timestamp", "desc"));

  tablaBody.innerHTML = '<tr><td colspan="5">Cargando...</td></tr>';

  unsubscribe = onSnapshot(q, (snap) => {
    try {
      if (snap.empty) {
        tablaBody.innerHTML = '<tr><td colspan="5">Sin registros de auditoría.</td></tr>';
        registrosActuales = [];
        return;
      }

      let docs = snap.docs.map((d) => ({ _id: d.id, ...d.data() }));

      // Filtrar localmente por acción
      if (accion !== "todas") {
        docs = docs.filter(d => d.accion === accion);
      }

      // Filtrar localmente por fecha (desde)
      if (fechaDesde) {
        // Usamos una fecha a medianoche en UTC o local
        const tsDesde = new Date(fechaDesde + "T00:00:00").getTime();
        docs = docs.filter(d => {
          if (!d.timestamp) return false;
          let dTime = 0;
          if (typeof d.timestamp.toDate === "function") {
            dTime = d.timestamp.toDate().getTime();
          } else {
            dTime = new Date(d.timestamp).getTime();
          }
          return dTime >= tsDesde;
        });
      }

      registrosActuales = docs;

      if (docs.length === 0) {
        tablaBody.innerHTML = '<tr><td colspan="5">No se encontraron coincidencias.</td></tr>';
        return;
      }

      tablaBody.innerHTML = docs.map((r) => `
        <tr>
          <td>${fmtFecha(r.timestamp)}</td>
          <td>${r.nombre_operador || r.uid_operador?.slice(0, 8) || "—"}</td>
          <td><code style="font-size:0.75rem">${r.accion || "—"}</code></td>
          <td style="font-size:0.82rem">${r.detalle || "—"}</td>
          <td><code style="font-size:0.75rem">${r.ip_cliente || "—"}</code></td>
        </tr>`).join("");
    } catch (err) {
      console.error("Error procesando los datos en onSnapshot:", err);
      tablaBody.innerHTML = `<tr><td colspan="5" style="color:red">Error procesando datos: ${err.message}</td></tr>`;
    }
  }, (error) => {
    console.error("Error cargando auditoría:", error);
    tablaBody.innerHTML = '<tr><td colspan="5" style="color:red">Error al cargar datos. Verifica la consola.</td></tr>';
  });
}

// ── Filtrar ────────────────────────────────────────────────────
form.addEventListener("submit", (e) => {
  e.preventDefault();
  cargarAuditoria(selAccion.value, inputFecha.value || null);
});

// ── Exportar a Excel ──────────────────────────────────────────
btnExportar.addEventListener("click", () => {
  if (!registrosActuales.length) {
    alert("No hay datos para exportar.");
    return;
  }
  if (typeof XLSX === "undefined") {
    alert("La librería de Excel no está disponible.");
    return;
  }

  const filas = registrosActuales.map((r) => ({
    "Fecha y Hora": r.timestamp?.toDate?.().toLocaleString("es-EC") || "",
    "Operador": r.nombre_operador || "",
    "UID Operador": r.uid_operador || "",
    "Acción": r.accion || "",
    "Detalle": r.detalle || "",
    "Dirección IP": r.ip_cliente || "",
    "Vista": r.vista || "",
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(filas);
  ws["!cols"] = [{ wch: 20 }, { wch: 22 }, { wch: 30 }, { wch: 22 }, { wch: 40 }, { wch: 16 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ws, "Auditoría SIGEP");
  XLSX.writeFile(wb, `SIGEP_Auditoria_${new Date().toISOString().slice(0, 10)}.xlsx`);
});

// ── Arranque ──────────────────────────────────────────────────
document.addEventListener("sigep:auth-ready", () => {
  cargarAuditoria(); // Carga todos los registros al iniciar
});
