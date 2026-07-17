// ============================================================
// views/carga-masiva.js — Carga masiva de CSV (P-09)
// Lee un archivo CSV en el navegador con FileReader,
// valida cada fila y la escribe en Firestore en lote.
// Formatos esperados:
//   Tarifas:  tipo_espacio,precio_por_hora,vigente_desde
//   Espacios: codigo_identificador,id_parqueadero,tipo_espacio,piso_nivel
// ============================================================

import { db } from "../firebase-config.js";
import {
  collection, addDoc, updateDoc, doc,
  query, where, getDocs, limit, writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ── DOM ───────────────────────────────────────────────────────
const form         = document.getElementById("form-carga-csv");
const msgDiv       = document.getElementById("msg-carga");
const tablaBody    = document.getElementById("tabla-resultado-carga");
const radioTarifas = document.getElementById("tipo-tarifas");
const radioEspacios= document.getElementById("tipo-espacios");
const camposRango  = document.getElementById("campos-rango");
const btnPlantTar  = document.getElementById("btn-plantilla-tarifas");
const btnPlantEsp  = document.getElementById("btn-plantilla-espacios");

// Mostrar/ocultar campos de rango según tipo
radioTarifas.addEventListener("change",  () => { camposRango.style.display = "none"; });
radioEspacios.addEventListener("change", () => { camposRango.style.display = "block"; });
camposRango.style.display = "none";

// ── Utilidades ────────────────────────────────────────────────
function mostrarMsg(tipo, msg) {
  msgDiv.innerHTML = `<div class="alert alert-${tipo}">${msg}</div>`;
}

/**
 * Parsea un CSV en texto a un array de objetos.
 * La primera fila es el encabezado.
 */
function parsearCSV(texto) {
  const lineas = texto.split(/\r?\n/).filter((l) => l.trim());
  if (lineas.length < 2) return [];
  const headers = lineas[0].split(",").map((h) => h.trim());
  return lineas.slice(1).map((l, idx) => {
    const valores = l.split(",").map((v) => v.trim());
    const obj     = {};
    headers.forEach((h, i) => { obj[h] = valores[i] || ""; });
    obj._fila = idx + 2; // Número de fila en el CSV original
    return obj;
  });
}

/** Descarga un archivo de texto */
function descargarArchivo(nombre, contenido) {
  const blob = new Blob([contenido], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Plantillas ────────────────────────────────────────────────
btnPlantTar.addEventListener("click", () => {
  descargarArchivo(
    "plantilla_tarifas.csv",
    "tipo_espacio,precio_por_hora,vigente_desde\nestandar,1.50,2026-01-01\ndiscapacitados,0.75,2026-01-01\nelectrico,2.00,2026-01-01\nmotos,0.80,2026-01-01"
  );
});

btnPlantEsp.addEventListener("click", () => {
  descargarArchivo(
    "plantilla_espacios.csv",
    "codigo_identificador,id_parqueadero,tipo_espacio,piso_nivel\nA-01,sede1,estandar,1\nA-02,sede1,estandar,1\nB-01,sede1,discapacitados,1"
  );
});

// ── Procesar el CSV ───────────────────────────────────────────
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const fileInput = document.getElementById("archivo_csv");
  const archivo   = fileInput.files[0];
  const tipoCarga = document.querySelector('input[name="tipo_carga"]:checked').value;

  if (!archivo) {
    mostrarMsg("warning", "Selecciona un archivo CSV primero.");
    return;
  }

  mostrarMsg("info", "Procesando archivo...");
  tablaBody.innerHTML = "";

  // Leer el archivo con FileReader
  const reader = new FileReader();
  reader.onload = async (ev) => {
    const texto  = ev.target.result;
    const filas  = parsearCSV(texto);

    if (filas.length === 0) {
      mostrarMsg("danger", "El archivo está vacío o tiene un formato inválido.");
      return;
    }

    const resultados = [];
    const batch = writeBatch(db);
    let procesados = 0;

    for (const fila of filas) {
      try {
        if (tipoCarga === "tarifas") {
          await procesarFilaTarifa(fila, batch);
        } else {
          await procesarFilaEspacio(fila, batch);
        }
        resultados.push({ fila: fila._fila, dato: JSON.stringify(fila).slice(0,60), estado: "ok", detalle: "Procesado correctamente" });
        procesados++;
      } catch (err) {
        resultados.push({ fila: fila._fila, dato: JSON.stringify(fila).slice(0,60), estado: "error", detalle: err.message });
      }
    }

    // Confirmar el batch
    try {
      await batch.commit();
    } catch (err) {
      mostrarMsg("danger", `Error al escribir en Firestore: ${err.message}`);
      return;
    }

    mostrarMsg("success", `Proceso completado: ${procesados}/${filas.length} filas procesadas correctamente.`);

    tablaBody.innerHTML = resultados.map((r) => `
      <tr>
        <td>${r.fila}</td>
        <td style="font-size:0.78rem">${r.dato}…</td>
        <td>
          <span class="status ${r.estado === 'ok' ? 'status--green' : 'status--red'}">
            ${r.estado === 'ok' ? 'Creado/Actualizado' : 'Error'}
          </span>
        </td>
        <td style="font-size:0.78rem">${r.detalle}</td>
      </tr>`).join("");
  };

  reader.readAsText(archivo, "UTF-8");
});

// ── Procesar una fila de TARIFAS ──────────────────────────────
async function procesarFilaTarifa(fila, batch) {
  const tipo    = fila.tipo_espacio?.toLowerCase();
  const precio  = parseFloat(fila.precio_por_hora);
  const desde   = fila.vigente_desde;

  if (!tipo || isNaN(precio)) throw new Error("Campos obligatorios faltantes o inválidos.");

  // Buscar si ya existe una tarifa activa para ese tipo
  const q = query(
    collection(db, "tarifas"),
    where("tipo_espacio", "==", tipo),
    where("activo", "==", true),
    limit(1)
  );
  const snap = await getDocs(q);

  if (!snap.empty) {
    // Actualizar la existente
    batch.update(doc(db, "tarifas", snap.docs[0].id), {
      precio_por_hora: precio,
      vigente_desde:   desde || new Date().toISOString().slice(0, 10),
      actualizado_en:  new Date(),
    });
  } else {
    // Crear una nueva
    const nuevoRef = doc(collection(db, "tarifas"));
    batch.set(nuevoRef, {
      tipo_espacio:    tipo,
      precio_por_hora: precio,
      vigente_desde:   desde || new Date().toISOString().slice(0, 10),
      activo:          true,
      id_parqueadero:  "todos",
    });
  }
}

// ── Procesar una fila de ESPACIOS ─────────────────────────────
async function procesarFilaEspacio(fila, batch) {
  const codigo    = fila.codigo_identificador?.toUpperCase();
  const parqId    = fila.id_parqueadero;
  const tipo      = fila.tipo_espacio?.toLowerCase() || "estandar";
  const piso      = fila.piso_nivel || "1";

  const rangoIni  = document.getElementById("rango_codigo_inicio").value.trim().toUpperCase();
  const rangoFin  = document.getElementById("rango_codigo_fin").value.trim().toUpperCase();

  if (!codigo || !parqId) throw new Error("Código o parqueadero faltante.");

  // Validar rango si se especificó
  if (rangoIni && rangoFin && (codigo < rangoIni || codigo > rangoFin)) {
    throw new Error(`Código ${codigo} fuera del rango ${rangoIni}–${rangoFin}.`);
  }

  // Verificar si ya existe
  const q = query(collection(db, "espacios"), where("codigo_identificador", "==", codigo), limit(1));
  const snap = await getDocs(q);

  if (!snap.empty) {
    batch.update(doc(db, "espacios", snap.docs[0].id), {
      tipo_espacio:   tipo,
      piso_nivel:     piso,
      id_parqueadero: parqId,
      actualizado_en: new Date(),
    });
  } else {
    const nuevoRef = doc(collection(db, "espacios"));
    batch.set(nuevoRef, {
      codigo_identificador: codigo,
      id_parqueadero:       parqId,
      tipo_espacio:         tipo,
      piso_nivel:           piso,
      estado_actual:        "disponible",
      actualizado_en:       new Date(),
    });
  }
}
