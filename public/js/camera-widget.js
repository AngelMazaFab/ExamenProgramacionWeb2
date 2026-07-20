// ============================================================
// camera-widget.js — Componente reutilizable de cámara
// Permite abrir la cámara del dispositivo, tomar una foto,
// previsualizarla y guardarla en el campo de archivo asociado.
// Se inyecta automáticamente junto a cada <input type="file">
// que tenga accept="image/*".
// ============================================================

/**
 * Inicializa un widget de cámara junto a un input[type=file].
 * @param {string} fileInputId - ID del input file existente
 * @param {string} [previewImgId] - ID de un <img> de preview existente (opcional)
 */
export function inicializarCamara(fileInputId, previewImgId) {
  const fileInput = document.getElementById(fileInputId);
  if (!fileInput) return;

  const container = fileInput.parentElement;

  // Crear contenedor del widget
  const widget = document.createElement("div");
  widget.className = "camera-widget";
  widget.id = `camera-widget-${fileInputId}`;
  widget.innerHTML = `
    <div class="camera-widget__preview-area">
      <video class="camera-widget__video" autoplay playsinline style="display:none"></video>
      <canvas class="camera-widget__canvas" style="display:none"></canvas>
      <img class="camera-widget__snapshot" alt="Vista previa de la foto" style="display:none">
    </div>
    <div class="camera-widget__controls">
      <button type="button" class="camera-widget__btn camera-widget__btn--open" title="Abrir cámara">
        📷 Abrir Cámara
      </button>
      <button type="button" class="camera-widget__btn camera-widget__btn--capture" style="display:none" title="Tomar foto">
        📸 Tomar Foto
      </button>
      <button type="button" class="camera-widget__btn camera-widget__btn--save" style="display:none" title="Guardar foto">
        ✅ Guardar Foto
      </button>
      <button type="button" class="camera-widget__btn camera-widget__btn--retry" style="display:none" title="Repetir foto">
        🔄 Repetir
      </button>
      <button type="button" class="camera-widget__btn camera-widget__btn--close" style="display:none" title="Cerrar cámara">
        ✖ Cerrar
      </button>
    </div>
  `;

  // Insertar el widget después del input file
  fileInput.insertAdjacentElement("afterend", widget);

  // Referencias DOM del widget
  const video     = widget.querySelector(".camera-widget__video");
  const canvas    = widget.querySelector(".camera-widget__canvas");
  const snapshot  = widget.querySelector(".camera-widget__snapshot");
  const btnOpen    = widget.querySelector(".camera-widget__btn--open");
  const btnCapture = widget.querySelector(".camera-widget__btn--capture");
  const btnSave    = widget.querySelector(".camera-widget__btn--save");
  const btnRetry   = widget.querySelector(".camera-widget__btn--retry");
  const btnClose   = widget.querySelector(".camera-widget__btn--close");

  // Imagen de preview externa (e.g. foto de perfil circular)
  const externalPreview = previewImgId ? document.getElementById(previewImgId) : null;

  let mediaStream = null;
  let capturedDataUrl = null;

  // ── Abrir cámara ──────────────────────────────────────────
  btnOpen.addEventListener("click", async () => {
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      });
      video.srcObject = mediaStream;
      video.style.display = "block";
      snapshot.style.display = "none";
      btnOpen.style.display = "none";
      btnCapture.style.display = "";
      btnClose.style.display = "";
      btnSave.style.display = "none";
      btnRetry.style.display = "none";
    } catch (err) {
      console.error("Error al acceder a la cámara:", err);
      alert("No se pudo acceder a la cámara. Verifica los permisos del navegador.");
    }
  });

  // ── Tomar foto ────────────────────────────────────────────
  btnCapture.addEventListener("click", () => {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);
    capturedDataUrl = canvas.toDataURL("image/jpeg", 0.85);

    // Mostrar snapshot
    snapshot.src = capturedDataUrl;
    snapshot.style.display = "block";
    video.style.display = "none";

    // Actualizar preview externo si existe
    if (externalPreview) {
      externalPreview.src = capturedDataUrl;
    }

    // Cambiar botones
    btnCapture.style.display = "none";
    btnSave.style.display = "";
    btnRetry.style.display = "";
  });

  // ── Guardar foto ──────────────────────────────────────────
  btnSave.addEventListener("click", () => {
    if (!capturedDataUrl) return;

    // Convertir dataURL a File y asignarlo al input
    const blob = dataURLtoBlob(capturedDataUrl);
    const file = new File([blob], `captura_${Date.now()}.jpg`, { type: "image/jpeg" });

    // Crear un nuevo DataTransfer para asignar el File al input
    const dt = new DataTransfer();
    dt.items.add(file);
    fileInput.files = dt.files;

    // Disparar evento change para que otros listeners lo detecten
    fileInput.dispatchEvent(new Event("change", { bubbles: true }));

    // Detener cámara y limpiar UI
    detenerCamara();

    // Mantener snapshot visible como confirmación
    snapshot.style.display = "block";
    btnSave.style.display = "none";
    btnRetry.style.display = "none";
    btnClose.style.display = "none";
    btnOpen.style.display = "";
    btnOpen.textContent = "📷 Cambiar Foto";
  });

  // ── Repetir foto ──────────────────────────────────────────
  btnRetry.addEventListener("click", () => {
    capturedDataUrl = null;
    snapshot.style.display = "none";
    video.style.display = "block";
    btnCapture.style.display = "";
    btnSave.style.display = "none";
    btnRetry.style.display = "none";
  });

  // ── Cerrar cámara ─────────────────────────────────────────
  btnClose.addEventListener("click", () => {
    detenerCamara();
    video.style.display = "none";
    snapshot.style.display = capturedDataUrl ? "block" : "none";
    btnOpen.style.display = "";
    btnCapture.style.display = "none";
    btnSave.style.display = "none";
    btnRetry.style.display = "none";
    btnClose.style.display = "none";
  });

  // ── Sincronizar preview cuando se selecciona archivo manualmente ──
  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        snapshot.src = ev.target.result;
        snapshot.style.display = "block";
        if (externalPreview) {
          externalPreview.src = ev.target.result;
        }
      };
      reader.readAsDataURL(file);
    }
  });

  // ── Helpers ───────────────────────────────────────────────
  function detenerCamara() {
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
      mediaStream = null;
    }
    video.srcObject = null;
  }
}

/**
 * Convierte una data URL a un Blob.
 */
function dataURLtoBlob(dataURL) {
  const parts = dataURL.split(",");
  const mime = parts[0].match(/:(.*?);/)[1];
  const b64 = atob(parts[1]);
  const u8 = new Uint8Array(b64.length);
  for (let i = 0; i < b64.length; i++) {
    u8[i] = b64.charCodeAt(i);
  }
  return new Blob([u8], { type: mime });
}
