// ============================================================
// views/cierre-caja.js — Cierre de Caja (P-11)
// Calcula el total cobrado por el operador en su turno,
// calcula la diferencia con el monto físico, registra el
// cierre en Firestore y genera un PDF de arqueo con jsPDF.
// ============================================================

import { db } from "../firebase-config.js";
import {
  collection, addDoc, query, where, getDocs,
  orderBy, Timestamp, doc, getDoc, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ── DOM ───────────────────────────────────────────────────────
const msgDiv          = document.getElementById("msg-caja");
const form            = document.getElementById("form-cierre-caja");
const inputTotalSist  = document.getElementById("total_tickets_turno");
const inputFisicoEfec = document.getElementById("monto_fisico_efectivo");
const inputDiferencia = document.getElementById("diferencia_caja");
const estadoDifDiv    = document.getElementById("estado-diferencia");
const statTickets     = document.getElementById("caja-total-tickets");
const statSistema     = document.getElementById("caja-total-sistema");
const statTurno       = document.getElementById("caja-turno");
const tablaBody       = document.getElementById("tabla-cierres");

let totalSistema    = 0;
let totalTicketsCnt = 0;

function mostrarMsg(tipo, msg) {
  msgDiv.innerHTML = `<div class="alert alert-${tipo}">${msg}</div>`;
  setTimeout(() => { msgDiv.innerHTML = ""; }, 6000);
}

// ── Calcular diferencia al ingresar monto físico ─────────────
inputFisicoEfec.addEventListener("input", () => {
  const fisico      = parseFloat(inputFisicoEfec.value) || 0;
  const diferencia  = fisico - totalSistema;
  inputDiferencia.value = diferencia.toFixed(2);

  if (Math.abs(diferencia) < 0.01) {
    estadoDifDiv.innerHTML = `<span class="status status--green">Caja cuadrada ✔</span>`;
  } else if (diferencia > 0) {
    estadoDifDiv.innerHTML = `<span class="status status--amber">Sobrante: $${diferencia.toFixed(2)}</span>`;
  } else {
    estadoDifDiv.innerHTML = `<span class="status status--red">Faltante: $${Math.abs(diferencia).toFixed(2)}</span>`;
  }
});

// ── Cargar tickets del turno actual ──────────────────────────
document.addEventListener("sigep:auth-ready", async ({ detail }) => {
  const uid   = detail.user.uid;
  const turno = detail.perfil.turno || "matutino";

  statTurno.textContent = turno.charAt(0).toUpperCase() + turno.slice(1);

  // Inicio del día actual
  const hoyInicio = new Date();
  hoyInicio.setHours(0, 0, 0, 0);

  // Tickets pagados hoy por este operador
  const q = query(
    collection(db, "tickets"),
    where("id_operador_salida", "==", uid),
    where("estado_ticket", "in", ["Pagado", "pagado"]),
    where("fecha_hora_salida", ">=", Timestamp.fromDate(hoyInicio))
  );

  onSnapshot(q, (snap) => {
    totalTicketsCnt = snap.size;
    totalSistema    = snap.docs.reduce((sum, d) => sum + (d.data().monto_total_pagado || 0), 0);

    statTickets.textContent = totalTicketsCnt;
    statSistema.textContent = `$${totalSistema.toFixed(2)}`;
    inputTotalSist.value    = totalSistema.toFixed(2);

    // Recalcular diferencia si ya hay valor físico
    if (inputFisicoEfec.value) inputFisicoEfec.dispatchEvent(new Event("input"));
  });

  // Cargar historial de cierres del operador
  cargarHistorialCierres(uid);
});

async function cargarHistorialCierres(uid) {
  const q = query(
    collection(db, "cajas"),
    where("id_operador", "==", uid),
    orderBy("fecha", "desc")
  );

  onSnapshot(q, (snap) => {
    if (snap.empty) {
      tablaBody.innerHTML = '<tr><td colspan="7">Sin cierres anteriores.</td></tr>';
      return;
    }
    tablaBody.innerHTML = snap.docs.map((d) => {
      const c = d.data();
      const fechaStr = c.fecha?.toDate ? c.fecha.toDate().toLocaleDateString("es-EC") : "—";
      const difCss = c.diferencia >= 0 ? "status--green" : "status--red";
      return `
        <tr>
          <td>${fechaStr}</td>
          <td>${c.nombre_operador || "—"}</td>
          <td>${c.turno || "—"}</td>
          <td>$${Number(c.total_sistema || 0).toFixed(2)}</td>
          <td>$${Number(c.total_fisico_efectivo || 0).toFixed(2)}</td>
          <td><span class="status ${difCss}">$${Number(c.diferencia || 0).toFixed(2)}</span></td>
          <td>${c.pdf_generado ? '<span class="status status--green">Sí</span>' : "—"}</td>
        </tr>`;
    }).join("");
  });
}

// ── Cerrar caja y generar PDF ─────────────────────────────────
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const fisicoEfec = parseFloat(inputFisicoEfec.value);
  if (isNaN(fisicoEfec) || fisicoEfec < 0) {
    mostrarMsg("warning", "Ingresa el monto físico en efectivo contado.");
    return;
  }

  const diferencia = fisicoEfec - totalSistema;
  const uid        = window.SIGEP?.user?.uid;
  const perfil     = window.SIGEP?.perfil || {};

  try {
    // Registrar cierre en Firestore
    const cierreRef = await addDoc(collection(db, "cajas"), {
      id_operador:           uid,
      nombre_operador:       `${perfil.nombres || ""} ${perfil.apellidos || ""}`.trim(),
      turno:                 perfil.turno || "matutino",
      fecha:                 new Date(),
      total_sistema:         totalSistema,
      total_fisico_efectivo: fisicoEfec,
      diferencia,
      total_tickets:         totalTicketsCnt,
      estado:                "cerrada",
      pdf_generado:          true,
    });

    // Auditoría
    await addDoc(collection(db, "auditoria"), {
      timestamp:       new Date(),
      uid_operador:    uid,
      nombre_operador: `${perfil.nombres || ""} ${perfil.apellidos || ""}`.trim(),
      accion:          "cierre_caja",
      detalle:         `Cierre ID: ${cierreRef.id}. Sistema: $${totalSistema.toFixed(2)}, Físico: $${fisicoEfec.toFixed(2)}, Diferencia: $${diferencia.toFixed(2)}`,
      ip_cliente:      "N/A",
      vista:           "cierre-caja.html",
    });

    // Generar PDF con jsPDF
    generarPDFArqueo({
      cierreId:    cierreRef.id,
      operador:    `${perfil.nombres || ""} ${perfil.apellidos || ""}`.trim(),
      turno:       perfil.turno || "matutino",
      fecha:       new Date().toLocaleString("es-EC"),
      tickets:     totalTicketsCnt,
      sistema:     totalSistema,
      fisico:      fisicoEfec,
      diferencia,
    });

    mostrarMsg("success", "Caja cerrada correctamente. El PDF se descargará automáticamente.");
    form.reset();
    estadoDifDiv.innerHTML = "";

  } catch (err) {
    mostrarMsg("danger", `Error al cerrar caja: ${err.message}`);
  }
});

// ── Generar PDF de Arqueo con jsPDF ──────────────────────────
function generarPDFArqueo(datos) {
  if (typeof window.jspdf === "undefined") {
    alert("jsPDF no disponible. Descarga el comprobante más tarde.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit: "mm", format: "a5" });

  // Encabezado
  pdf.setFillColor(28, 30, 34); // --asphalt
  pdf.rect(0, 0, 148, 25, "F");
  pdf.setTextColor(245, 183, 0); // --paint-yellow
  pdf.setFontSize(14);
  pdf.setFont("helvetica", "bold");
  pdf.text("URBANPARK S.A. — SIGEP", 10, 10);
  pdf.setFontSize(10);
  pdf.text("COMPROBANTE DE ARQUEO DE CAJA", 10, 18);

  // Cuerpo
  pdf.setTextColor(28, 30, 34);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  let y = 35;
  const linea = (label, valor) => {
    pdf.setFont("helvetica", "bold");
    pdf.text(label, 10, y);
    pdf.setFont("helvetica", "normal");
    pdf.text(String(valor), 80, y);
    y += 8;
  };

  linea("Cierre ID:",         datos.cierreId.slice(0, 16) + "…");
  linea("Operador:",          datos.operador);
  linea("Turno:",             datos.turno);
  linea("Fecha:",             datos.fecha);
  linea("Tickets cobrados:",  datos.tickets);
  y += 4;
  pdf.setDrawColor(200, 148, 0);
  pdf.line(10, y, 138, y);
  y += 6;
  linea("Total sistema ($):", `$${datos.sistema.toFixed(2)}`);
  linea("Total físico ($):",  `$${datos.fisico.toFixed(2)}`);

  const difColor = datos.diferencia >= 0 ? [47, 158, 68] : [214, 72, 63];
  pdf.setTextColor(...difColor);
  pdf.setFont("helvetica", "bold");
  pdf.text(`Diferencia:`, 10, y);
  pdf.text(`$${datos.diferencia.toFixed(2)} ${datos.diferencia >= 0 ? "(Sobrante)" : "(Faltante)"}`, 80, y);
  pdf.setTextColor(28, 30, 34);
  y += 12;

  // Pie
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "italic");
  pdf.text("Documento generado automáticamente por SIGEP. No requiere firma.", 10, y);
  pdf.text(`© 2026 UrbanPark S.A.`, 10, y + 5);

  pdf.save(`Arqueo_${datos.operador.replace(/\s/g,"_")}_${new Date().toISOString().slice(0,10)}.pdf`);
}
