import { db } from "../firebase-config.js";
import { collection, doc, getDoc, addDoc, query, where, getDocs, limit } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const form = document.getElementById("form-encuesta");
const msgDiv = document.getElementById("msg-encuesta");

let ticketDataGlobal = null;
let propietarioGlobal = null;

async function iniciarEncuesta() {
  const params = new URLSearchParams(location.search);
  const ticketId = params.get("ticket");

  if (!ticketId) {
    msgDiv.innerHTML = `<div class="alert alert-danger">Enlace inválido. No se encontró el ticket.</div>`;
    return;
  }

  try {
    const snap = await getDoc(doc(db, "tickets", ticketId));
    if (!snap.exists()) {
      msgDiv.innerHTML = `<div class="alert alert-danger">Ticket no encontrado.</div>`;
      return;
    }
    
    ticketDataGlobal = snap.data();
    document.getElementById("ticketId").value = ticketId;
    
    const qV = query(collection(db, "vehiculos"), where("placa", "==", ticketDataGlobal.placa_vehiculo), limit(1));
    const vSnap = await getDocs(qV);
    if (!vSnap.empty) {
      propietarioGlobal = vSnap.docs[0].data().nombre_propietario || "Desconocido";
    } else {
      propietarioGlobal = "Desconocido";
    }

    form.style.display = "flex";
    form.style.flexDirection = "column";
    form.style.gap = "1rem";
  } catch (err) {
    msgDiv.innerHTML = `<div class="alert alert-danger">Error: ${err.message}</div>`;
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("btn-enviar-encuesta");
  btn.disabled = true;

  try {
    const ticketId = document.getElementById("ticketId").value;
    const calificacion = document.getElementById("calificacion").value;
    const comentarios = document.getElementById("comentarios").value;

    await addDoc(collection(db, "encuestas"), {
      ticket_id: ticketId,
      calificacion: parseInt(calificacion),
      comentarios: comentarios,
      placa_vehiculo: ticketDataGlobal.placa_vehiculo,
      propietario: propietarioGlobal,
      codigo_espacio: ticketDataGlobal.codigo_espacio,
      tiempo_total_segundos: ticketDataGlobal.tiempo_total_segundos,
      id_operador: ticketDataGlobal.id_operador_salida,
      fecha_encuesta: new Date()
    });

    form.style.display = "none";
    msgDiv.innerHTML = `<div class="alert alert-success">¡Gracias por tus respuestas! Tu encuesta ha sido enviada con éxito.</div>`;
  } catch (err) {
    msgDiv.innerHTML = `<div class="alert alert-danger">Error al enviar: ${err.message}</div>`;
    btn.disabled = false;
  }
});

iniciarEncuesta();
