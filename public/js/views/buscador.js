// ============================================================
// views/buscador.js — Buscador Rápido por Placa (P-03)
// Busca un vehículo en Firestore por placa y muestra su estado
// actual (dentro/fuera del estacionamiento) y ticket activo.
// ============================================================

import { db } from "../firebase-config.js";
import {
  collection, query, where, getDocs, limit
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const form       = document.getElementById("form-busqueda");
const resultadoSec = document.getElementById("resultado-busqueda");
const resultadoDiv = document.getElementById("resultado-contenido");

/**
 * Formatea una fecha en formato legible.
 */
function fmtFecha(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString("es-EC", { dateStyle: "short", timeStyle: "short" });
}

/**
 * Calcula tiempo transcurrido desde una fecha.
 */
function tiempoTranscurrido(tsIngreso) {
  const ahora     = Date.now();
  const ingreso   = tsIngreso.toDate ? tsIngreso.toDate().getTime() : new Date(tsIngreso).getTime();
  const diffSeg   = Math.floor((ahora - ingreso) / 1000);
  const horas     = Math.floor(diffSeg / 3600);
  const minutos   = Math.floor((diffSeg % 3600) / 60);
  return `${horas}h ${minutos}min`;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const placa = document.getElementById("placa-busqueda").value.trim().toUpperCase();

  if (!placa) {
    resultadoDiv.innerHTML = `<div class="alert alert-warning">Ingresa una placa para buscar.</div>`;
    resultadoSec.style.display = "block";
    return;
  }

  resultadoDiv.innerHTML = `<div class="alert alert-info">Buscando...</div>`;
  resultadoSec.style.display = "block";

  try {
    // 1. Buscar el vehículo
    const qV = query(collection(db, "vehiculos"), where("placa", "==", placa), limit(1));
    const vehiculoSnap = await getDocs(qV);

    if (vehiculoSnap.empty) {
      resultadoDiv.innerHTML = `<div class="alert alert-danger">No se encontró ningún vehículo con la placa <strong>${placa}</strong>.</div>`;
      return;
    }

    const vehiculoData = vehiculoSnap.docs[0].data();

    // 2. Buscar ticket ACTIVO para esta placa
    const qT = query(
      collection(db, "tickets"),
      where("placa_vehiculo", "==", placa),
      where("estado_ticket", "in", ["Activo", "activo"]),
      limit(1)
    );
    const ticketSnap = await getDocs(qT);

    let htmlEstado = "";
    if (!ticketSnap.empty) {
      const ticket = ticketSnap.docs[0].data();
      const ticketId = ticketSnap.docs[0].id;
      htmlEstado = `
        <dl>
          <dt>Estado</dt>
          <dd><span class="status status--red">Dentro del parqueadero</span></dd>
          <dt>Ticket activo</dt>
          <dd><a href="/comprobante.html?ticket=${ticketId}">${ticketId.slice(0, 8)}…</a></dd>
          <dt>Tiempo transcurrido</dt>
          <dd>${tiempoTranscurrido(ticket.fecha_hora_ingreso)}</dd>
          <dt>Espacio asignado</dt>
          <dd>${ticket.codigo_espacio || "—"}</dd>
          <dt>Ingreso</dt>
          <dd>${fmtFecha(ticket.fecha_hora_ingreso)}</dd>
        </dl>`;
    } else {
      htmlEstado = `
        <dl>
          <dt>Estado</dt>
          <dd><span class="status status--green">Fuera del estacionamiento</span></dd>
          <dt>Último ingreso</dt>
          <dd>Sin ticket activo en este momento.</dd>
        </dl>`;
    }

    resultadoDiv.innerHTML = `
      <dl style="margin-bottom:1rem">
        <dt>Placa</dt>       <dd><strong>${vehiculoData.placa}</strong></dd>
        <dt>Propietario</dt> <dd>${vehiculoData.nombre_propietario || "—"}</dd>
        <dt>Vehículo</dt>    <dd>${vehiculoData.marca || ""} ${vehiculoData.modelo || ""} — ${vehiculoData.color || "—"}</dd>
        <dt>Teléfono</dt>    <dd>${vehiculoData.telefono_contacto || "—"}</dd>
      </dl>
      <hr style="margin:0.75rem 0;border-top:1px solid var(--concrete-line)">
      ${htmlEstado}`;

  } catch (err) {
    console.error("Buscador error:", err);
    resultadoDiv.innerHTML = `<div class="alert alert-danger">Error al buscar: ${err.message}</div>`;
  }
});
