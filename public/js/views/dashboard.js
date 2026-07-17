// ============================================================
// views/dashboard.js — Controlador del Dashboard (P-02)
// Carga estadísticas en tiempo real desde Firestore y
// renderiza gráficas con Chart.js.
// ============================================================

import { db } from "../firebase-config.js";
import {
  collection, query, where,
  onSnapshot, getDocs, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Esperar a que auth-guard confirme la sesión
document.addEventListener("sigep:auth-ready", iniciarDashboard, { once: true });

let graficaPastel = null;
let graficaBarras = null;

async function iniciarDashboard() {
  escucharEspacios();
  cargarTicketsHoy();
  cargarSedes();
}

// ── Escucha en tiempo real el estado de los espacios ──────────
function escucharEspacios() {
  const q = collection(db, "espacios");
  onSnapshot(q, (snap) => {
    let total = 0, ocupados = 0, disponibles = 0;

    snap.forEach((doc) => {
      total++;
      const estado = doc.data().estado_actual;
      if (estado === "ocupado")    ocupados++;
      if (estado === "disponible") disponibles++;
    });

    document.getElementById("stat-total").textContent       = total;
    document.getElementById("stat-ocupadas").textContent    = ocupados;
    document.getElementById("stat-disponibles").textContent = disponibles;

    actualizarGraficaPastel(ocupados, disponibles, total - ocupados - disponibles);
  });
}

// ── Tickets de hoy ────────────────────────────────────────────
async function cargarTicketsHoy() {
  const hoyInicio = new Date();
  hoyInicio.setHours(0, 0, 0, 0);

  const q = query(
    collection(db, "tickets"),
    where("fecha_hora_ingreso", ">=", Timestamp.fromDate(hoyInicio))
  );

  onSnapshot(q, (snap) => {
    let totalTickets    = 0;
    let totalRecaudado  = 0;
    const facturacionPorHora = new Array(24).fill(0);

    snap.forEach((doc) => {
      const t = doc.data();
      totalTickets++;
      if (t.estado_ticket === "pagado" || t.estado_ticket === "Pagado") {
        totalRecaudado += t.monto_total_pagado || 0;
      }
      // Agrupar por hora de ingreso
      if (t.fecha_hora_ingreso?.toDate) {
        const hora = t.fecha_hora_ingreso.toDate().getHours();
        facturacionPorHora[hora] += t.monto_total_pagado || 0;
      }
    });

    document.getElementById("stat-tickets").textContent    = totalTickets;
    document.getElementById("stat-recaudado").textContent  = `$${totalRecaudado.toFixed(2)}`;

    actualizarGraficaBarras(facturacionPorHora);
  });
}

// ── Resumen de sedes ──────────────────────────────────────────
async function cargarSedes() {
  const tbody = document.getElementById("tabla-sedes");
  const sedesSnap = await getDocs(collection(db, "parqueaderos"));

  if (sedesSnap.empty) {
    tbody.innerHTML = '<tr><td colspan="5">No hay sedes registradas.</td></tr>';
    return;
  }

  // Para cada sede, contar sus espacios
  const promises = sedesSnap.docs.map(async (sedeDoc) => {
    const sedeId   = sedeDoc.id;
    const sedeData = sedeDoc.data();

    const qE = query(collection(db, "espacios"), where("id_parqueadero", "==", sedeId));
    const espaciosSnap = await getDocs(qE);

    let capacidad = 0, ocupados = 0, disponibles = 0;
    espaciosSnap.forEach((e) => {
      capacidad++;
      const estado = e.data().estado_actual;
      if (estado === "ocupado")    ocupados++;
      if (estado === "disponible") disponibles++;
    });

    const pct = capacidad > 0 ? Math.round((ocupados / capacidad) * 100) : 0;
    return `
      <tr>
        <td>${sedeData.nombre || sedeId}</td>
        <td>${capacidad}</td>
        <td>${ocupados}</td>
        <td>${disponibles}</td>
        <td>
          <span class="status ${pct >= 80 ? 'status--red' : pct >= 50 ? 'status--amber' : 'status--green'}">
            ${pct}%
          </span>
        </td>
      </tr>`;
  });

  const filas = await Promise.all(promises);
  tbody.innerHTML = filas.join("") || '<tr><td colspan="5">Sin datos.</td></tr>';
}

// ── Gráfica de pastel con Chart.js ────────────────────────────
function actualizarGraficaPastel(ocupados, disponibles, mantenimiento) {
  const ctx = document.getElementById("grafica-pastel");
  if (!ctx || typeof Chart === "undefined") return;

  if (graficaPastel) graficaPastel.destroy();

  graficaPastel = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Ocupados", "Disponibles", "Mantenimiento"],
      datasets: [{
        data: [ocupados, disponibles, mantenimiento],
        backgroundColor: ["#D6483F", "#2F9E44", "#4A4E58"],
        borderColor: "#1C1E22",
        borderWidth: 2,
      }]
    },
    options: {
      plugins: {
        legend: { labels: { color: "#1C1E22", font: { family: "IBM Plex Mono", size: 12 } } },
        tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${ctx.parsed} plazas` } }
      },
      cutout: "60%"
    }
  });
}

// ── Gráfica de barras con Chart.js ───────────────────────────
function actualizarGraficaBarras(facturacionPorHora) {
  const ctx = document.getElementById("grafica-barras");
  if (!ctx || typeof Chart === "undefined") return;

  if (graficaBarras) graficaBarras.destroy();

  const labels = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2,"0")}:00`);

  graficaBarras = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Recaudación ($)",
        data: facturacionPorHora,
        backgroundColor: "#F5B700",
        borderColor: "#C99400",
        borderWidth: 1,
      }]
    },
    options: {
      plugins: {
        legend: { labels: { color: "#1C1E22", font: { family: "IBM Plex Mono", size: 11 } } }
      },
      scales: {
        x: { ticks: { color: "#4A4E58", font: { size: 10 } } },
        y: {
          ticks: { color: "#4A4E58", callback: (v) => `$${v}` },
          beginAtZero: true
        }
      }
    }
  });
}
