// ============================================================
// views/idioma-voz.js — Traducción y Texto a Voz (P-14)
// Usa la Web Speech API del navegador para leer el reglamento
// en el idioma seleccionado. No requiere backend.
// El contenido del reglamento está en múltiples idiomas
// directamente en este archivo.
// ============================================================

// ── Contenido del reglamento en múltiples idiomas ────────────
const REGLAMENTO = {
  es: {
    titulo: "Reglamento y Tarifas Vigentes",
    texto: `
      <h4>Reglamento Interno — UrbanPark S.A.</h4>
      <ol>
        <li>El tiempo de estacionamiento se cobra por fracción de hora.</li>
        <li>El propietario es responsable de los objetos que deje en el vehículo.</li>
        <li>El parqueadero no se hace responsable por daños causados por terceros.</li>
        <li>El ticket debe presentarse al momento de la salida.</li>
        <li>Queda prohibido lavar vehículos dentro de las instalaciones.</li>
        <li>Velocidad máxima dentro del parqueadero: 5 km/h.</li>
        <li>Los espacios marcados para discapacitados son exclusivos con documento de respaldo.</li>
        <li>El horario de atención es de 06:00 a 22:00 horas, todos los días.</li>
      </ol>
      <h4>Tarifas Vigentes</h4>
      <ul>
        <li>Estándar: $1.50 / hora</li>
        <li>Motos: $0.80 / hora</li>
        <li>Eléctricos: $2.00 / hora (incluye carga)</li>
        <li>Discapacitados: $0.75 / hora</li>
      </ul>
    `,
    texto_plano: `Reglamento Interno de UrbanPark S.A. El tiempo de estacionamiento se cobra por fracción de hora. El propietario es responsable de los objetos que deje en el vehículo. El parqueadero no se hace responsable por daños causados por terceros. El ticket debe presentarse al momento de la salida. Queda prohibido lavar vehículos dentro de las instalaciones. Velocidad máxima cinco kilómetros por hora. Los espacios para discapacitados son exclusivos. Horario de atención: seis a veintidós horas. Tarifas: Estándar un dólar cincuenta por hora. Motos ochenta centavos por hora. Eléctricos dos dólares por hora. Discapacitados setenta y cinco centavos por hora.`,
    lang: "es-EC",
  },
  en: {
    titulo: "Regulations and Current Rates",
    texto: `
      <h4>Internal Regulations — UrbanPark S.A.</h4>
      <ol>
        <li>Parking time is charged per fraction of an hour.</li>
        <li>The owner is responsible for items left in the vehicle.</li>
        <li>The parking lot is not responsible for damage caused by third parties.</li>
        <li>The ticket must be presented at the time of exit.</li>
        <li>Washing vehicles inside the facilities is prohibited.</li>
        <li>Maximum speed inside the parking lot: 5 km/h.</li>
        <li>Spaces marked for disabled persons are exclusive with supporting documentation.</li>
        <li>Operating hours are from 06:00 to 22:00 every day.</li>
      </ol>
      <h4>Current Rates</h4>
      <ul>
        <li>Standard: $1.50 / hour</li>
        <li>Motorcycles: $0.80 / hour</li>
        <li>Electric: $2.00 / hour (charging included)</li>
        <li>Disabled: $0.75 / hour</li>
      </ul>
    `,
    texto_plano: `UrbanPark S.A. Internal Regulations. Parking time is charged per fraction of an hour. The owner is responsible for items left in the vehicle. The parking lot is not responsible for damage caused by third parties. The ticket must be presented at the time of exit. Washing vehicles inside the facilities is prohibited. Maximum speed five kilometers per hour. Disabled spaces are exclusive. Operating hours: six to twenty-two hours. Rates: Standard one dollar fifty per hour. Motorcycles eighty cents per hour. Electric two dollars per hour. Disabled seventy-five cents per hour.`,
    lang: "en-US",
  },
  fr: {
    titulo: "Règlement et Tarifs en Vigueur",
    texto: `
      <h4>Règlement Interne — UrbanPark S.A.</h4>
      <ol>
        <li>Le temps de stationnement est facturé par fraction d'heure.</li>
        <li>Le propriétaire est responsable des objets laissés dans le véhicule.</li>
        <li>Le parking n'est pas responsable des dommages causés par des tiers.</li>
        <li>Le ticket doit être présenté à la sortie.</li>
        <li>Il est interdit de laver des véhicules dans les installations.</li>
        <li>Vitesse maximale à l'intérieur du parking : 5 km/h.</li>
        <li>Les places réservées aux personnes handicapées sont exclusives.</li>
        <li>Heures d'ouverture : 06h00 à 22h00 tous les jours.</li>
      </ol>
      <h4>Tarifs en Vigueur</h4>
      <ul>
        <li>Standard : 1,50 $ / heure</li>
        <li>Motos : 0,80 $ / heure</li>
        <li>Électriques : 2,00 $ / heure</li>
        <li>Handicapés : 0,75 $ / heure</li>
      </ul>
    `,
    texto_plano: `Règlement Interne d'UrbanPark. Le temps de stationnement est facturé par fraction d'heure. Le propriétaire est responsable des objets laissés dans le véhicule. Le parking n'est pas responsable des dommages causés par des tiers. Le ticket doit être présenté à la sortie. Il est interdit de laver des véhicules dans les installations. Vitesse maximale cinq kilomètres par heure. Places réservées aux personnes handicapées exclusives. Heures d'ouverture: six à vingt-deux heures. Tarifs: Standard un dollar cinquante par heure. Motos quatre-vingts centimes. Électriques deux dollars. Handicapés soixante-quinze centimes.`,
    lang: "fr-FR",
  },
  de: {
    titulo: "Vorschriften und aktuelle Tarife",
    texto: `
      <h4>Interne Vorschriften — UrbanPark S.A.</h4>
      <ol>
        <li>Die Parkzeit wird pro Bruchteil einer Stunde berechnet.</li>
        <li>Der Eigentümer ist für im Fahrzeug gelassene Gegenstände verantwortlich.</li>
        <li>Das Parkhaus haftet nicht für Schäden durch Dritte.</li>
        <li>Das Ticket muss beim Ausgang vorgelegt werden.</li>
        <li>Das Waschen von Fahrzeugen in der Anlage ist verboten.</li>
        <li>Höchstgeschwindigkeit im Parkhaus: 5 km/h.</li>
        <li>Stellplätze für Behinderte sind exklusiv mit entsprechenden Dokumenten.</li>
        <li>Öffnungszeiten: 06:00 bis 22:00 Uhr täglich.</li>
      </ol>
      <h4>Aktuelle Tarife</h4>
      <ul>
        <li>Standard: 1,50 $ / Stunde</li>
        <li>Motorräder: 0,80 $ / Stunde</li>
        <li>Elektrisch: 2,00 $ / Stunde</li>
        <li>Behinderte: 0,75 $ / Stunde</li>
      </ul>
    `,
    texto_plano: `Interne Vorschriften von UrbanPark. Die Parkzeit wird pro Bruchteil einer Stunde berechnet. Der Eigentümer ist für im Fahrzeug gelassene Gegenstände verantwortlich. Das Parkhaus haftet nicht für Schäden durch Dritte. Das Ticket muss beim Ausgang vorgelegt werden. Waschen von Fahrzeugen in der Anlage verboten. Höchstgeschwindigkeit fünf Kilometer pro Stunde. Behindertenparkplätze sind exklusiv. Öffnungszeiten sechs bis zweiundzwanzig Uhr. Tarife: Standard ein Komma fünfzig Dollar. Motorräder achtzig Cent. Elektrisch zwei Dollar. Behinderte fünfundsiebzig Cent.`,
    lang: "de-DE",
  },
};

// ── Estado ────────────────────────────────────────────────────
let idiomaActual = "es";
let utterancia   = null;

// ── DOM ───────────────────────────────────────────────────────
const formIdioma     = document.getElementById("form-idioma");
const selIdioma      = document.getElementById("idioma");
const textDiv        = document.getElementById("texto-reglamento");
const tituloH3       = document.getElementById("titulo-reglamento");
const btnEscuchar    = document.getElementById("btn-escuchar");
const btnPausar      = document.getElementById("btn-pausar");
const btnDetener     = document.getElementById("btn-detener");
const estadoVozDiv   = document.getElementById("estado-voz");
const formTrad       = document.getElementById("form-traduccion");
const textareaTexto  = document.getElementById("texto-traducir");

// ── Verificar soporte Web Speech ──────────────────────────────
const soporteVoz = "speechSynthesis" in window;
if (!soporteVoz) {
  estadoVozDiv.innerHTML = `<div class="alert alert-warning">Tu navegador no soporta la síntesis de voz. Usa Chrome o Edge.</div>`;
  [btnEscuchar, btnPausar, btnDetener].forEach((b) => (b.disabled = true));
}

// ── Renderizar reglamento ─────────────────────────────────────
function renderizarReglamento(idioma) {
  const reg = REGLAMENTO[idioma] || REGLAMENTO.es;
  tituloH3.textContent = reg.titulo;
  textDiv.innerHTML    = reg.texto;
}

// ── Cambiar idioma ─────────────────────────────────────────────
formIdioma.addEventListener("submit", (e) => {
  e.preventDefault();
  detenerVoz();
  idiomaActual = selIdioma.value;
  renderizarReglamento(idiomaActual);
});

// ── Text-to-Speech con Web Speech API ────────────────────────
function hablar(texto, lang) {
  if (!soporteVoz) return;
  window.speechSynthesis.cancel();

  utterancia = new SpeechSynthesisUtterance(texto);
  utterancia.lang  = lang;
  utterancia.rate  = 0.95;
  utterancia.pitch = 1;

  utterancia.onstart = () => {
    estadoVozDiv.textContent = "🔊 Reproduciendo...";
    btnEscuchar.style.display = "none";
    btnPausar.style.display   = "inline-block";
    btnDetener.style.display  = "inline-block";
  };

  utterancia.onend = () => {
    estadoVozDiv.textContent = "✔ Reproducción finalizada.";
    btnEscuchar.style.display = "inline-block";
    btnPausar.style.display   = "none";
    btnDetener.style.display  = "none";
    setTimeout(() => { estadoVozDiv.textContent = ""; }, 3000);
  };

  utterancia.onerror = (e) => {
    estadoVozDiv.textContent = `Error de síntesis: ${e.error}`;
  };

  window.speechSynthesis.speak(utterancia);
}

function detenerVoz() {
  if (!soporteVoz) return;
  window.speechSynthesis.cancel();
  btnEscuchar.style.display = "inline-block";
  btnPausar.style.display   = "none";
  btnDetener.style.display  = "none";
  estadoVozDiv.textContent  = "";
}

// ── Botones de voz ────────────────────────────────────────────
btnEscuchar.addEventListener("click", () => {
  const reg = REGLAMENTO[idiomaActual] || REGLAMENTO.es;
  hablar(reg.texto_plano, reg.lang);
});

btnPausar.addEventListener("click", () => {
  if (window.speechSynthesis.paused) {
    window.speechSynthesis.resume();
    btnPausar.textContent = "⏸ Pausar";
    estadoVozDiv.textContent = "🔊 Reproduciendo...";
  } else {
    window.speechSynthesis.pause();
    btnPausar.textContent = "▶ Reanudar";
    estadoVozDiv.textContent = "⏸ Pausado.";
  }
});

btnDetener.addEventListener("click", detenerVoz);

// ── Leer texto personalizado ──────────────────────────────────
formTrad.addEventListener("submit", (e) => {
  e.preventDefault();
  const texto = textareaTexto.value.trim();
  if (!texto) return;
  const reg = REGLAMENTO[idiomaActual] || REGLAMENTO.es;
  hablar(texto, reg.lang);
});

// ── Arranque ──────────────────────────────────────────────────
document.addEventListener("sigep:auth-ready", () => {
  renderizarReglamento(idiomaActual);
});
