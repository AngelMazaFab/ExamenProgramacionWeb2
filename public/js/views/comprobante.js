// ============================================================
// views/comprobante.js — Comprobante de Pago (P-13)
// Busca un ticket por ID o placa, muestra sus datos,
// genera un código QR único con qrcode.js y permite
// descargar el comprobante como PDF con jsPDF.
// También permite anular tickets (solo super_admin).
// ============================================================

import { db } from "../firebase-config.js";
import {
  collection, doc, getDoc, query, where,
  getDocs, updateDoc, addDoc, limit
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ── DOM ───────────────────────────────────────────────────────
const form          = document.getElementById("form-buscar-ticket");
const contenidoDiv  = document.getElementById("comprobante-contenido");
const msgDiv        = document.getElementById("msg-comprobante");
const btnDescargar  = document.getElementById("btn-descargar-pdf");
const btnAnular     = document.getElementById("btn-anular-ticket");
const qrCanvas      = document.getElementById("qr-canvas");

let ticketActual = null;
let ticketIdActual = null;

function mostrarMsg(tipo, msg) {
  msgDiv.innerHTML = `<div class="alert alert-${tipo}">${msg}</div>`;
  setTimeout(() => { msgDiv.innerHTML = ""; }, 6000);
}

function fmtFecha(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString("es-EC", { dateStyle: "short", timeStyle: "short" });
}

function segundosATexto(seg) {
  if (!seg) return "—";
  const h = Math.floor(seg / 3600);
  const m = Math.floor((seg % 3600) / 60);
  return `${h}h ${m}min`;
}

// ── Buscar ticket ─────────────────────────────────────────────
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const busqueda = document.getElementById("ticket-id-busqueda").value.trim();
  if (!busqueda) return;

  contenidoDiv.style.display = "none";
  msgDiv.innerHTML = `<div class="alert alert-info">Buscando...</div>`;

  try {
    let ticketSnap = null;
    let ticketId   = null;

    // Intentar como ID directo primero (sensible a mayúsculas/minúsculas)
    const directoRef  = doc(db, "tickets", busqueda);
    const directoSnap = await getDoc(directoRef);

    if (directoSnap.exists()) {
      ticketSnap = directoSnap.data();
      ticketId   = directoSnap.id;
    } else {
      // Buscar por placa (último ticket pagado) usando la placa en mayúsculas
      const placaBusqueda = busqueda.toUpperCase();
      const q = query(
        collection(db, "tickets"),
        where("placa_vehiculo", "==", placaBusqueda),
        where("estado_ticket", "in", ["Pagado", "pagado", "Activo", "activo"]),
        limit(1)
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        msgDiv.innerHTML = `<div class="alert alert-danger">No se encontró ningún ticket para "<strong>${busqueda}</strong>".</div>`;
        return;
      }
      ticketSnap = snap.docs[0].data();
      ticketId   = snap.docs[0].id;
    }

    ticketActual   = ticketSnap;
    ticketIdActual = ticketId;

    // Llenar campos del comprobante
    document.getElementById("comp-ticket-id").textContent = ticketId.slice(0, 16) + "…";
    document.getElementById("comp-placa").textContent     = ticketSnap.placa_vehiculo || "—";
    document.getElementById("comp-espacio").textContent   = ticketSnap.codigo_espacio  || "—";
    document.getElementById("comp-ingreso").textContent   = fmtFecha(ticketSnap.fecha_hora_ingreso);
    document.getElementById("comp-salida").textContent    = fmtFecha(ticketSnap.fecha_hora_salida);
    document.getElementById("comp-tiempo").textContent    = segundosATexto(ticketSnap.tiempo_total_segundos);
    document.getElementById("comp-tarifa").textContent    = ticketSnap.tarifa_aplicada != null ? `$${ticketSnap.tarifa_aplicada}/h` : "—";
    document.getElementById("comp-total").textContent     = ticketSnap.monto_total_pagado != null ? `$${Number(ticketSnap.monto_total_pagado).toFixed(2)}` : "—";
    document.getElementById("comp-metodo").textContent    = ticketSnap.metodo_pago || "—";

    const estado = (ticketSnap.estado_ticket || "").toLowerCase();
    const estadoCss = { pagado: "status--green", activo: "status--blue", anulado: "status--red" };
    document.getElementById("comp-estado").innerHTML = `<span class="status ${estadoCss[estado] || ''}">${ticketSnap.estado_ticket || "—"}</span>`;

    // Obtener nombre del propietario del vehículo
    const qV = query(collection(db, "vehiculos"), where("placa", "==", ticketSnap.placa_vehiculo), limit(1));
    const vSnap = await getDocs(qV);
    document.getElementById("comp-cliente").textContent = !vSnap.empty ? (vSnap.docs[0].data().nombre_propietario || "—") : "—";

    // Obtener sede del espacio
    if (ticketSnap.id_espacio) {
      const espSnap = await getDoc(doc(db, "espacios", ticketSnap.id_espacio));
      if (espSnap.exists() && espSnap.data().id_parqueadero) {
        const parqSnap = await getDoc(doc(db, "parqueaderos", espSnap.data().id_parqueadero));
        document.getElementById("comp-sede").textContent = `UrbanPark S.A. — ${parqSnap.exists() ? parqSnap.data().nombre : "Sede"}`;
      }
    }

    // Solo super_admin puede anular
    btnAnular.style.display = (window.SIGEP?.rol === "super_admin" && estado === "activo") ? "inline-block" : "none";

    // Generar QR
    generarQR(ticketId);

    msgDiv.innerHTML = "";
    contenidoDiv.style.display = "block";

  } catch (err) {
    msgDiv.innerHTML = `<div class="alert alert-danger">Error: ${err.message}</div>`;
  }
});

// ── Generar QR ────────────────────────────────────────────────
function generarQR(ticketId) {
  if (typeof QRCode === "undefined") return;
  const url = `${location.origin}/comprobante.html?ticket=${ticketId}`;
  QRCode.toCanvas(qrCanvas, url, { width: 140, margin: 1 }, (err) => {
    if (err) console.warn("QR error:", err);
  });
}

// ── Descargar PDF ─────────────────────────────────────────────
btnDescargar.addEventListener("click", () => {
  if (!ticketActual || typeof window.jspdf === "undefined") {
    alert("No hay ticket cargado o jsPDF no disponible.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit: "mm", format: "a5" });

  // Encabezado oscuro
  pdf.setFillColor(28, 30, 34);
  pdf.rect(0, 0, 148, 28, "F");
  pdf.setTextColor(245, 183, 0);
  pdf.setFontSize(13);
  pdf.setFont("helvetica", "bold");
  pdf.text("URBANPARK S.A. — SIGEP", 10, 11);
  pdf.setFontSize(9);
  pdf.text("COMPROBANTE DE PAGO", 10, 19);
  pdf.text(document.getElementById("comp-sede").textContent, 10, 25);

  pdf.setTextColor(28, 30, 34);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);

  let y = 38;
  const campo = (label, val) => {
    pdf.setFont("helvetica", "bold");
    pdf.text(label, 10, y);
    pdf.setFont("helvetica", "normal");
    pdf.text(String(val || "—"), 60, y);
    y += 7;
  };

  campo("Ticket ID:",       ticketIdActual.slice(0, 20));
  campo("Cliente:",         document.getElementById("comp-cliente").textContent);
  campo("Placa:",           ticketActual.placa_vehiculo);
  campo("Espacio:",         ticketActual.codigo_espacio);
  campo("Ingreso:",         fmtFecha(ticketActual.fecha_hora_ingreso));
  campo("Salida:",          fmtFecha(ticketActual.fecha_hora_salida));
  campo("Tiempo:",          segundosATexto(ticketActual.tiempo_total_segundos));
  campo("Tarifa:",          ticketActual.tarifa_aplicada != null ? `$${ticketActual.tarifa_aplicada}/h` : "—");
  campo("Método de Pago:",  ticketActual.metodo_pago);

  y += 3;
  pdf.setDrawColor(200, 148, 0);
  pdf.line(10, y, 138, y);
  y += 7;

  pdf.setFontSize(13);
  pdf.setFont("helvetica", "bold");
  pdf.text("TOTAL PAGADO:", 10, y);
  pdf.setTextColor(47, 158, 68);
  pdf.text(`$${Number(ticketActual.monto_total_pagado || 0).toFixed(2)}`, 80, y);

  y += 10;
  pdf.setTextColor(28, 30, 34);
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "italic");
  pdf.text("Conserve este comprobante. Verifique el QR en SIGEP.", 10, y);
  
  if ((ticketActual.estado_ticket || "").toLowerCase() === "pagado") {
    y += 6;
    pdf.setFont("helvetica", "bold");
    pdf.text("¡Ayúdanos a mejorar! Evalúa nuestro servicio en:", 10, y);
    y += 5;
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(0, 86, 210);
    const surveyUrl = `${location.origin}/encuesta.html?ticket=${ticketIdActual}`;
    pdf.text(surveyUrl, 10, y);
    y += 10;
  }

  // Si existe una foto de evidencia (en formato Base64)
  if (ticketActual.evidencia_salida_url && ticketActual.evidencia_salida_url.startsWith("data:image/")) {
    pdf.setTextColor(28, 30, 34);
    pdf.setFont("helvetica", "bold");
    pdf.text("FOTO DE EVIDENCIA:", 10, y);
    y += 3;
    try {
      // Ajustar dimensiones (ej. 100x75 mm)
      pdf.addImage(ticketActual.evidencia_salida_url, "JPEG", 10, y, 100, 75);
    } catch (err) {
      console.warn("No se pudo agregar la foto al PDF:", err);
    }
  }

  pdf.save(`Comprobante_${ticketActual.placa_vehiculo}_${new Date().toISOString().slice(0,10)}.pdf`);
});

// ── Anular ticket ─────────────────────────────────────────────
btnAnular.addEventListener("click", async () => {
  if (!ticketIdActual) return;
  if (!confirm("¿Anular este ticket? Esta acción se registrará en la auditoría.")) return;

  try {
    await updateDoc(doc(db, "tickets", ticketIdActual), { estado_ticket: "Anulado" });

    if (ticketActual.id_espacio) {
      await updateDoc(doc(db, "espacios", ticketActual.id_espacio), {
        estado_actual: "disponible", actualizado_en: new Date()
      });
    }

    await addDoc(collection(db, "auditoria"), {
      timestamp:       new Date(),
      uid_operador:    window.SIGEP?.user?.uid || "",
      nombre_operador: `${window.SIGEP?.perfil?.nombres || ""} ${window.SIGEP?.perfil?.apellidos || ""}`.trim(),
      accion:          "anulacion_ticket",
      detalle:         `Ticket ${ticketIdActual} anulado desde comprobante.html`,
      ip_cliente:      "N/A",
      vista:           "comprobante.html",
    });

    mostrarMsg("success", "Ticket anulado y espacio liberado.");
    document.getElementById("comp-estado").innerHTML = `<span class="status status--red">Anulado</span>`;
    btnAnular.style.display = "none";

  } catch (err) {
    mostrarMsg("danger", `Error al anular: ${err.message}`);
  }
});

// ── Leer query param ?ticket=... al cargar ────────────────────
document.addEventListener("sigep:auth-ready", () => {
  const params   = new URLSearchParams(location.search);
  const ticketId = params.get("ticket");
  if (ticketId) {
    document.getElementById("ticket-id-busqueda").value = ticketId;
    form.dispatchEvent(new Event("submit"));
  }
});
