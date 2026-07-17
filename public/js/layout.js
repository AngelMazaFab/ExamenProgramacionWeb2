// ============================================================
// layout.js
// Inyecta los componentes compartidos (header, nav, footer)
// en cada página. Marca el enlace activo en el nav y oculta
// los elementos que el rol del usuario no puede ver.
//
// Uso: <script type="module" src="/js/layout.js"></script>
// como PRIMER script en cada página protegida.
// ============================================================

// Elementos del nav con su rol mínimo requerido
// (los que no aparecen aquí son visibles para todos)
const NAV_ROLES = {
  "espacios.html":     ["super_admin", "supervisor"],
  "operadores.html":   ["super_admin", "supervisor"],
  "reportes.html":     ["super_admin", "supervisor"],
  "carga-masiva.html": ["super_admin"],
  "auditoria.html":    ["super_admin", "supervisor"],
};

/**
 * Carga un parcial HTML y lo inyecta en el elemento destino.
 * @param {string} url  - Ruta del archivo parcial
 * @param {string} id   - ID del elemento contenedor destino
 */
async function cargarParcial(url, id) {
  const el = document.getElementById(id);
  if (!el) return;
  try {
    const res  = await fetch(url);
    const html = await res.text();
    el.innerHTML = html;
  } catch (e) {
    console.warn(`Layout: no se pudo cargar ${url}`, e);
  }
}

/**
 * Marca el enlace activo en el nav basándose en la URL actual.
 * Oculta ítems del nav según el rol del usuario.
 */
function configurarNav(rol) {
  const paginaActual = location.pathname.split("/").pop() || "index.html";
  const links = document.querySelectorAll("#layout-nav a[data-page]");

  links.forEach(link => {
    const pagina = link.getAttribute("data-page");

    // Marcar activo
    if (pagina === paginaActual) {
      link.classList.add("nav-active");
      link.setAttribute("aria-current", "page");
    }

    // Ocultar si el rol no tiene acceso
    const rolesPermitidos = NAV_ROLES[pagina];
    if (rolesPermitidos && !rolesPermitidos.includes(rol)) {
      link.closest("li")?.remove();
    }
  });

  // Mostrar nombre del operador en el header si existe el slot
  const slotUsuario = document.getElementById("layout-usuario");
  if (slotUsuario && window.SIGEP?.perfil) {
    const p = window.SIGEP.perfil;
    slotUsuario.textContent = `${p.nombres} ${p.apellidos} · ${(p.rol || "operador").replace("_", " ").toUpperCase()}`;
  }
}

// Cargar parciales al iniciar
(async () => {
  await Promise.all([
    cargarParcial("/components/header.html", "layout-header"),
    cargarParcial("/components/nav.html",    "layout-nav"),
    cargarParcial("/components/footer.html", "layout-footer"),
  ]);

  // Configurar botón de cerrar sesión
  const btnLogout = document.getElementById("btn-logout");
  if (btnLogout) {
    btnLogout.addEventListener("click", async (e) => {
      e.preventDefault();
      const { auth } = await import("/js/firebase-config.js");
      const { signOut } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
      await signOut(auth);
      location.href = "/login.html";
    });
  }

  // Si auth-guard ya disparó el evento, configurar el nav ahora.
  // Si no, esperar el evento.
  if (window.SIGEP?.rol) {
    configurarNav(window.SIGEP.rol);
  } else {
    document.addEventListener("sigep:auth-ready", (e) => {
      configurarNav(e.detail.rol);
    }, { once: true });
  }
})();
