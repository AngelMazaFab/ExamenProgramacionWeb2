// ============================================================
// views/reportes.js — Reportes Financieros + Exportación XLSX (P-08)
// Filtra tickets por fecha, turno y método de pago desde
// Firestore. Exporta los resultados a Excel usando SheetJS
// (disponible globalmente via CDN como window.XLSX).
// ============================================================

import { db } from "../firebase-config.js";
import {
  collection, query, where, getDocs,
  orderBy, Timestamp, getDoc, doc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ── DOM ───────────────────────────────────────────────────────
const form           = document.getElementById("form-filtros");
const tablaBody      = document.getElementById("tabla-reportes");
const btnExportar    = document.getElementById("btn-exportar-xlsx");
const resumenDiv     = document.getElementById("resumen-reporte");

// Cache de los datos actuales para exportar
let datosActuales = [];

// ── Utilidades ────────────────────────────────────────────────
function fmtFecha(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString("es-EC", { dateStyle: "short", timeStyle: "short" });
}

function segundosAMinutos(seg) {
  if (!seg) return 0;
  return Math.round(seg / 60);
}

// ── Nombres de operadores en caché ───────────────────────────
const nombresOp = {};
async function obtenerNombreOperador(uid) {
  if (!uid) return "—";
  if (nombresOp[uid]) return nombresOp[uid];
  const snap = await getDoc(doc(db, "operadores", uid));
  if (snap.exists()) {
    const o = snap.data();
    nombresOp[uid] = `${o.nombres || ""} ${o.apellidos || ""}`.trim() || uid;
  } else {
    nombresOp[uid] = uid.slice(0, 8);
  }
  return nombresOp[uid];
}

// ── Filtrar y cargar datos ────────────────────────────────────
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const fechaIni    = document.getElementById("fecha_inicio").value;
  const fechaFin    = document.getElementById("fecha_fin").value;
  const turno       = document.getElementById("turno_filtro").value;
  const metodoPago  = document.getElementById("metodo_pago_filtro").value;

  tablaBody.innerHTML = '<tr><td colspan="7">Cargando...</td></tr>';
  resumenDiv.innerHTML = "";

  try {
    // Construir query base
    let constraints = [orderBy("fecha_hora_ingreso", "desc")];

    if (fechaIni) {
      constraints.push(where("fecha_hora_ingreso", ">=", Timestamp.fromDate(new Date(fechaIni + "T00:00:00"))));
    }
    if (fechaFin) {
      constraints.push(where("fecha_hora_ingreso", "<=", Timestamp.fromDate(new Date(fechaFin + "T23:59:59"))));
    }
    if (metodoPago !== "todos") {
      constraints.push(where("metodo_pago", "==", metodoPago));
    }

    const q = query(collection(db, "tickets"), ...constraints);
    const snap = await getDocs(q);

    let tickets = snap.docs.map((d) => ({ _id: d.id, ...d.data() }));

    // Filtrar por turno (el turno está en el operador, no en el ticket,
    // así que usamos el turno del operador de ingreso)
    if (turno !== "todos") {
      const ticketsFiltrados = [];
      for (const t of tickets) {
        if (t.id_operador_ingreso) {
          const opSnap = await getDoc(doc(db, "operadores", t.id_operador_ingreso));
          if (opSnap.exists() && opSnap.data().turno === turno) {
            ticketsFiltrados.push(t);
          }
        }
      }
      tickets = ticketsFiltrados;
    }

    // Calcular resumen
    const totalMonto = tickets
      .filter((t) => (t.estado_ticket || "").toLowerCase() === "pagado")
      .reduce((sum, t) => sum + (t.monto_total_pagado || 0), 0);

    resumenDiv.innerHTML = `
      <strong>Resultados: ${tickets.length} ticket(s)</strong> ·
      Total recaudado (pagados): <strong>$${totalMonto.toFixed(2)}</strong>`;

    if (tickets.length === 0) {
      tablaBody.innerHTML = '<tr><td colspan="7">Sin resultados para los filtros aplicados.</td></tr>';
      datosActuales = [];
      return;
    }

    // Renderizar tabla
    const filas = await Promise.all(tickets.map(async (t) => {
      const opNombre = await obtenerNombreOperador(t.id_operador_ingreso);
      return {
        ...t,
        _opNombre: opNombre,
      };
    }));

    datosActuales = filas;

    tablaBody.innerHTML = filas.map((t) => `
      <tr>
        <td title="${t._id}">${t._id.slice(0,6)}…</td>
        <td>${fmtFecha(t.fecha_hora_ingreso)}</td>
        <td>${t.placa_vehiculo || "—"}</td>
        <td>${t._opNombre}</td>
        <td>${t.metodo_pago || "—"}</td>
        <td>${segundosAMinutos(t.tiempo_total_segundos)} min</td>
        <td>${t.monto_total_pagado != null ? '$'+Number(t.monto_total_pagado).toFixed(2) : "—"}</td>
      </tr>`).join("");

  } catch (err) {
    console.error("reportes.js:", err);
    tablaBody.innerHTML = `<tr><td colspan="7"><div class="alert alert-danger">Error: ${err.message}</div></td></tr>`;
  }
});

// ── Exportar a Excel con SheetJS ──────────────────────────────
btnExportar.addEventListener("click", () => {
  if (!datosActuales.length) {
    alert("No hay datos para exportar. Aplica los filtros primero.");
    return;
  }
  if (typeof XLSX === "undefined") {
    alert("La librería de Excel no está disponible. Revisa la conexión a internet.");
    return;
  }

  const filas = datosActuales.map((t) => ({
    "Ticket ID":       t._id,
    "Placa":           t.placa_vehiculo     || "",
    "Espacio":         t.codigo_espacio     || "",
    "Ingreso":         t.fecha_hora_ingreso?.toDate?.().toLocaleString("es-EC") || "",
    "Salida":          t.fecha_hora_salida?.toDate?.().toLocaleString("es-EC")  || "",
    "Tiempo (min)":    segundosAMinutos(t.tiempo_total_segundos),
    "Tarifa ($/h)":    t.tarifa_aplicada    || "",
    "Monto ($)":       t.monto_total_pagado != null ? Number(t.monto_total_pagado).toFixed(2) : "",
    "Método de Pago":  t.metodo_pago        || "",
    "Estado":          t.estado_ticket      || "",
    "Operador Ingreso": t._opNombre         || "",
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(filas);

  // Ajustar ancho de columnas
  ws["!cols"] = Object.keys(filas[0]).map(() => ({ wch: 18 }));

  XLSX.utils.book_append_sheet(wb, ws, "Reporte SIGEP");

  const fechaStr = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `SIGEP_Reporte_${fechaStr}.xlsx`);
});

// ── Arranque ──────────────────────────────────────────────────
document.addEventListener("sigep:auth-ready", () => {
  // Establecer fecha de hoy como valor por defecto
  const hoy = new Date().toISOString().slice(0, 10);
  document.getElementById("fecha_inicio").value = hoy;
  document.getElementById("fecha_fin").value    = hoy;
});
