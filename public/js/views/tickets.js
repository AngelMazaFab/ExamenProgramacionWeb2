// ============================================================
// views/tickets.js — Check-in / Check-out de Vehículos (P-06)
// Registra ingresos y salidas, calcula tiempo y monto según
// tarifa vigente en Firestore, y actualiza estado de espacios.
// ============================================================

import { db } from "../firebase-config.js";
import {
  collection, doc, addDoc, updateDoc,
  onSnapshot, query, where, getDocs, orderBy, limit, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { inicializarCamara } from "../camera-widget.js";

// ── Helper: convertir File a Base64 ──────────────────────────
async function fileToBase64Ticket(file, maxSize = 400) {
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

// ── Inicializar cámara para evidencia de salida ──────────────
inicializarCamara("foto_evidencia_salida");

// ── DOM ───────────────────────────────────────────────────────
const formCheckin   = document.getElementById("form-checkin");
const formCheckout  = document.getElementById("form-checkout");
const msgCheckin    = document.getElementById("msg-checkin");
const msgCheckout   = document.getElementById("msg-checkout");
const tablaTickets  = document.getElementById("tabla-tickets");
const selEspacio    = document.getElementById("id_espacio_asignado");
const selTicket     = document.getElementById("id_ticket_salida");
const inputTiempo   = document.getElementById("tiempo_total");
const inputTarifa   = document.getElementById("tarifa_aplicada");
const inputMonto    = document.getElementById("monto_total_pagado");
const inputFechaSal = document.getElementById("fecha_hora_salida");
const infoVehiculo  = document.getElementById("info-vehiculo");

// Establece la fecha/hora actual en los inputs datetime-local
function fechaActual() {
  const ahora = new Date();
  // Formato: YYYY-MM-DDTHH:MM
  return ahora.toISOString().slice(0, 16);
}

function mostrarMsg(div, tipo, msg) {
  div.innerHTML = `<div class="alert alert-${tipo}">${msg}</div>`;
  setTimeout(() => { div.innerHTML = ""; }, 6000);
}

function fmtFecha(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString("es-EC", { dateStyle: "short", timeStyle: "short" });
}

// ── Obtener tarifa vigente para un tipo de espacio ────────────
async function obtenerTarifa(tipoEspacio = "estandar") {
  const q = query(
    collection(db, "tarifas"),
    where("tipo_espacio", "==", tipoEspacio),
    where("activo", "==", true),
    limit(1)
  );
  const snap = await getDocs(q);
  if (!snap.empty) return snap.docs[0].data().precio_por_hora || 1.5;
  // Tarifa por defecto si no hay configuración
  return 1.5;
}

// ── Cargar espacios disponibles en el select ──────────────────
async function cargarEspaciosDisponibles() {
  const q = query(collection(db, "espacios"), where("estado_actual", "==", "disponible"));
  const snap = await getDocs(q);
  selEspacio.innerHTML = '<option value="">— Seleccionar espacio —</option>';
  snap.forEach((d) => {
    const e = d.data();
    selEspacio.innerHTML += `<option value="${d.id}" data-tipo="${e.tipo_espacio || 'estandar'}">${e.codigo_identificador} (${e.tipo_espacio || "estándar"})</option>`;
  });
}

// ── Cargar tickets activos en el select de checkout ───────────
function cargarTicketsActivos() {
  const q = query(
    collection(db, "tickets"),
    where("estado_ticket", "in", ["Activo", "activo"])
  );
  onSnapshot(q, (snap) => {
    selTicket.innerHTML = '<option value="">— Seleccionar ticket activo —</option>';
    snap.forEach((d) => {
      const t = d.data();
      selTicket.innerHTML += `<option value="${d.id}" data-ingreso="${t.fecha_hora_ingreso?.toDate?.().toISOString() || ''}" data-tipo="${t.tipo_espacio || 'estandar'}">${t.placa_vehiculo} — ${fmtFecha(t.fecha_hora_ingreso)}</option>`;
    });
  });
}

// ── Calcular tiempo y monto al seleccionar ticket ─────────────
async function recalcularMonto() {
  const selected = selTicket.selectedOptions[0];
  if (!selected || !selected.dataset.ingreso) {
    inputTiempo.value = "";
    inputMonto.value  = "";
    return;
  }

  const ingreso  = new Date(selected.dataset.ingreso);
  const salidaVal = inputFechaSal.value;
  const salida   = salidaVal ? new Date(salidaVal) : new Date();

  const segundos = Math.max(0, Math.floor((salida - ingreso) / 1000));
  inputTiempo.value = segundos;

  const tarifa = await obtenerTarifa(selected.dataset.tipo || "estandar");
  inputTarifa.value = tarifa;

  const tipoCobro = document.getElementById("tipo_cobro").value;
  let monto = 0;
  if (tipoCobro === "hora") {
    const horas = segundos / 3600;
    monto = horas * tarifa;
  } else {
    const dias = Math.max(1, Math.ceil(segundos / 86400));
    monto = dias * (tarifa * 24);
  }
  inputMonto.value  = monto.toFixed(2);
}

selTicket.addEventListener("change", recalcularMonto);
document.getElementById("tipo_cobro").addEventListener("change", recalcularMonto);
inputFechaSal.addEventListener("change", recalcularMonto);

// ── CHECKIN ───────────────────────────────────────────────────
formCheckin.addEventListener("submit", async (e) => {
  e.preventDefault();
  const placa      = document.getElementById("placa_ingreso").value.trim().toUpperCase();
  const espacioId  = selEspacio.value;
  const fechaIngreso = document.getElementById("fecha_hora_ingreso").value;

  if (!placa || !espacioId || !fechaIngreso) {
    mostrarMsg(msgCheckin, "warning", "Completa todos los campos del check-in.");
    return;
  }

  try {
    // Leer tipo de espacio
    const espacioDoc = await getDoc(doc(db, "espacios", espacioId));
    const espacioData = espacioDoc.data();

    // Leer tarifa
    const tarifa = await obtenerTarifa(espacioData.tipo_espacio || "estandar");

    // Crear ticket
    const ticketRef = await addDoc(collection(db, "tickets"), {
      placa_vehiculo:         placa,
      id_espacio:             espacioId,
      codigo_espacio:         espacioData.codigo_identificador,
      tipo_espacio:           espacioData.tipo_espacio || "estandar",
      id_operador_ingreso:    window.SIGEP?.user?.uid || "",
      id_operador_salida:     null,
      fecha_hora_ingreso:     new Date(fechaIngreso),
      fecha_hora_salida:      null,
      tiempo_total_segundos:  null,
      tarifa_aplicada:        tarifa,
      monto_total_pagado:     null,
      metodo_pago:            null,
      estado_ticket:          "Activo",
      comprobante_pdf_url:    null,
    });

    // Marcar espacio como Ocupado
    await updateDoc(doc(db, "espacios", espacioId), {
      estado_actual:  "ocupado",
      actualizado_en: new Date(),
    });

    // Auditoría
    await addDoc(collection(db, "auditoria"), {
      timestamp:       new Date(),
      uid_operador:    window.SIGEP?.user?.uid || "",
      nombre_operador: `${window.SIGEP?.perfil?.nombres || ""} ${window.SIGEP?.perfil?.apellidos || ""}`.trim(),
      accion:          "checkin",
      detalle:         `Check-in placa ${placa} espacio ${espacioData.codigo_identificador}, ticket ${ticketRef.id}`,
      ip_cliente:      "N/A",
      vista:           "tickets.html",
    });

    mostrarMsg(msgCheckin, "success", `✔ Ingreso registrado. Ticket ID: ${ticketRef.id.slice(0,8)}…`);
    formCheckin.reset();
    document.getElementById("fecha_hora_ingreso").value = fechaActual();
    await cargarEspaciosDisponibles();

  } catch (err) {
    console.error(err);
    mostrarMsg(msgCheckin, "danger", `Error: ${err.message}`);
  }
});

// ── CHECKOUT ──────────────────────────────────────────────────
formCheckout.addEventListener("submit", async (e) => {
  e.preventDefault();
  const ticketId   = selTicket.value;
  const fechaSalida = inputFechaSal.value;
  const metodoPago  = document.getElementById("metodo_pago").value;
  const fileEvidencia = document.getElementById("foto_evidencia_salida").files[0];

  if (!ticketId || !fechaSalida) {
    mostrarMsg(msgCheckout, "warning", "Selecciona el ticket y la fecha de salida.");
    return;
  }

  try {
    const ticketSnap = await getDoc(doc(db, "tickets", ticketId));
    const ticketData = ticketSnap.data();
    const ingreso    = ticketData.fecha_hora_ingreso.toDate ? ticketData.fecha_hora_ingreso.toDate() : new Date(ticketData.fecha_hora_ingreso);
    const salida     = new Date(fechaSalida);

    const tipoCobro  = document.getElementById("tipo_cobro").value;
    const segundos   = Math.max(0, Math.floor((salida - ingreso) / 1000));
    const tarifa     = await obtenerTarifa(ticketData.tipo_espacio || "estandar");
    
    let monto = 0;
    if (tipoCobro === "hora") {
      monto = parseFloat(((segundos / 3600) * tarifa).toFixed(2));
    } else {
      const dias = Math.max(1, Math.ceil(segundos / 86400));
      monto = parseFloat((dias * (tarifa * 24)).toFixed(2));
    }

    // Convertir evidencia de salida a Base64 si existe
    let evidenciaUrl = null;
    if (fileEvidencia) {
      evidenciaUrl = await fileToBase64Ticket(fileEvidencia);
    }

    // Actualizar el ticket
    await updateDoc(doc(db, "tickets", ticketId), {
      fecha_hora_salida:     salida,
      tiempo_total_segundos: segundos,
      tipo_cobro:            tipoCobro,
      tarifa_aplicada:       tarifa,
      monto_total_pagado:    monto,
      metodo_pago:           metodoPago,
      estado_ticket:         "Pagado",
      id_operador_salida:    window.SIGEP?.user?.uid || "",
      evidencia_salida_url:  evidenciaUrl,
    });

    // Marcar espacio como Disponible
    if (ticketData.id_espacio) {
      await updateDoc(doc(db, "espacios", ticketData.id_espacio), {
        estado_actual:  "disponible",
        actualizado_en: new Date(),
      });
    }

    // Auditoría
    await addDoc(collection(db, "auditoria"), {
      timestamp:       new Date(),
      uid_operador:    window.SIGEP?.user?.uid || "",
      nombre_operador: `${window.SIGEP?.perfil?.nombres || ""} ${window.SIGEP?.perfil?.apellidos || ""}`.trim(),
      accion:          "checkout",
      detalle:         `Check-out placa ${ticketData.placa_vehiculo}, cobro por ${tipoCobro}, monto $${monto}, método ${metodoPago}`,
      ip_cliente:      "N/A",
      vista:           "tickets.html",
    });

    mostrarMsg(msgCheckout, "success", `✔ Salida registrada. Monto cobrado: $${monto.toFixed(2)}`);
    formCheckout.reset();
    inputFechaSal.value = fechaActual();
    await cargarEspaciosDisponibles();

  } catch (err) {
    console.error(err);
    mostrarMsg(msgCheckout, "danger", `Error: ${err.message}`);
  }
});

// ── Listado de tickets en tiempo real ─────────────────────────
function iniciarListadoTickets() {
  const q = query(collection(db, "tickets"), orderBy("fecha_hora_ingreso", "desc"));
  onSnapshot(q, (snap) => {
    if (snap.empty) {
      tablaTickets.innerHTML = '<tr><td colspan="9">No hay tickets registrados.</td></tr>';
      return;
    }
    tablaTickets.innerHTML = snap.docs.map((d) => {
      const t  = d.data();
      const id = d.id;
      const estadoCss = {
        activo: "status--blue", activo2: "status--blue",
        pagado: "status--green",
        anulado: "status--red",
      };
      const estado = (t.estado_ticket || "").toLowerCase();
      const css = estadoCss[estado] || "";

      return `
        <tr>
          <td title="${id}">${id.slice(0,6)}…</td>
          <td>${t.placa_vehiculo || "—"}</td>
          <td>${t.codigo_espacio || "—"}</td>
          <td>${fmtFecha(t.fecha_hora_ingreso)}</td>
          <td>${fmtFecha(t.fecha_hora_salida)}</td>
          <td>${t.monto_total_pagado != null ? '$'+Number(t.monto_total_pagado).toFixed(2) : "—"}</td>
          <td>${t.metodo_pago || "—"}</td>
          <td><span class="status ${css}">${t.estado_ticket || "—"}</span></td>
          <td class="actions">
            <a href="/comprobante.html?ticket=${id}">Ver</a> ·
            <a href="#" class="btn-anular-ticket" data-id="${id}" style="${estado !== 'activo' ? 'display:none' : ''}">Anular</a>
          </td>
        </tr>`;
    }).join("");

    // Adjuntar evento de anulación
    document.querySelectorAll(".btn-anular-ticket").forEach((btn) => {
      btn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        if (!confirm("¿Anular este ticket?")) return;
        try {
          const ticketSnap = await getDoc(doc(db, "tickets", btn.dataset.id));
          const ticketData = ticketSnap.data();
          await updateDoc(doc(db, "tickets", btn.dataset.id), { estado_ticket: "Anulado" });
          if (ticketData.id_espacio) {
            await updateDoc(doc(db, "espacios", ticketData.id_espacio), {
              estado_actual: "disponible", actualizado_en: new Date()
            });
          }
          await addDoc(collection(db, "auditoria"), {
            timestamp:       new Date(),
            uid_operador:    window.SIGEP?.user?.uid || "",
            nombre_operador: `${window.SIGEP?.perfil?.nombres || ""} ${window.SIGEP?.perfil?.apellidos || ""}`.trim(),
            accion:          "anulacion_ticket",
            detalle:         `Ticket ${btn.dataset.id} anulado`,
            ip_cliente:      "N/A",
            vista:           "tickets.html",
          });
        } catch (err) {
          alert(`Error al anular: ${err.message}`);
        }
      });
    });
  });
}

// ── Búsqueda de vehículo por placa al escribir ────────────────
document.getElementById("placa_ingreso").addEventListener("input", async (e) => {
  const placa = e.target.value.trim().toUpperCase();
  if (placa.length < 3) { infoVehiculo.textContent = ""; return; }
  const q = query(collection(db, "vehiculos"), where("placa", "==", placa), limit(1));
  const snap = await getDocs(q);
  if (!snap.empty) {
    const v = snap.docs[0].data();
    infoVehiculo.textContent = `✔ ${v.nombre_propietario || "Propietario desconocido"} — ${v.marca || ""} ${v.modelo || ""}`;
  } else {
    infoVehiculo.textContent = "⚠ Vehículo no registrado en el sistema.";
  }
});

// ── Arranque ──────────────────────────────────────────────────
document.addEventListener("sigep:auth-ready", async () => {
  document.getElementById("fecha_hora_ingreso").value = fechaActual();
  document.getElementById("fecha_hora_salida").value  = fechaActual();

  await cargarEspaciosDisponibles();
  cargarTicketsActivos();
  iniciarListadoTickets();
});
