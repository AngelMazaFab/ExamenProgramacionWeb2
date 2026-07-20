import { db } from "../firebase-config.js";
import { collection, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const tabla = document.getElementById("tabla-encuestas");

function segundosATexto(seg) {
  if (!seg) return "—";
  const h = Math.floor(seg / 3600);
  const m = Math.floor((seg % 3600) / 60);
  return `${h}h ${m}min`;
}

document.addEventListener("sigep:auth-ready", () => {
  const q = query(collection(db, "encuestas"), orderBy("fecha_encuesta", "desc"));
  
  onSnapshot(q, (snap) => {
    if (snap.empty) {
      tabla.innerHTML = '<tr><td colspan="6">Aún no hay encuestas registradas.</td></tr>';
      return;
    }
    
    tabla.innerHTML = snap.docs.map(d => {
      const e = d.data();
      let estrellas = "⭐".repeat(e.calificacion || 0);
      return `
        <tr>
          <td>${estrellas} (${e.calificacion}/5)</td>
          <td>${e.propietario || "—"}</td>
          <td>${e.placa_vehiculo || "—"}</td>
          <td>${e.codigo_espacio || "—"}</td>
          <td>${segundosATexto(e.tiempo_total_segundos)}</td>
          <td title="${e.id_operador || ''}">${(e.id_operador || "—").slice(0, 8)}…</td>
        </tr>
      `;
    }).join("");
  }, (error) => {
    console.error("Error al obtener encuestas:", error);
    tabla.innerHTML = `<tr><td colspan="6">Error al cargar encuestas. Revisa los permisos de Firestore.</td></tr>`;
  });
});
