// ============================================================
// auth-guard.js
// Verifica que el usuario esté autenticado y tenga el rol
// correcto para ver la página actual. Si no, redirige.
//
// Uso: <script type="module" src="/js/auth-guard.js"></script>
// en cada página protegida (todas excepto login.html e index.html)
// ============================================================

import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc }        from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Mapa de permisos: qué roles pueden acceder a cada página.
// 'todos' = cualquier usuario autenticado puede verla.
const PERMISOS = {
  "dashboard.html":    ["super_admin", "supervisor", "operador"],
  "buscador.html":     ["super_admin", "supervisor", "operador"],
  "vehiculos.html":    ["super_admin", "supervisor", "operador"],
  "espacios.html":     ["super_admin", "supervisor"],
  "tickets.html":      ["super_admin", "supervisor", "operador"],
  "operadores.html":   ["super_admin", "supervisor"],
  "reportes.html":     ["super_admin", "supervisor"],
  "carga-masiva.html": ["super_admin"],
  "perfil.html":       ["super_admin", "supervisor", "operador"],
  "cierre-caja.html":  ["super_admin", "supervisor", "operador"],
  "auditoria.html":    ["super_admin", "supervisor"],
  "comprobante.html":  ["super_admin", "supervisor", "operador"],
  "idioma-voz.html":   ["super_admin", "supervisor", "operador"],
  "sorpresa.html":     ["super_admin", "supervisor", "operador"],
};

// Nombre de la página actual (ej. "dashboard.html")
const paginaActual = location.pathname.split("/").pop() || "index.html";

// Exponer el usuario y su rol globalmente para que los
// controladores de vista puedan usarlo.
window.SIGEP = window.SIGEP || {};

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    // No autenticado → ir al login
    location.href = "/login.html";
    return;
  }

  // Leer el documento del operador para obtener su rol
  const operadorRef = doc(db, "operadores", user.uid);
  const operadorSnap = await getDoc(operadorRef);

  if (!operadorSnap.exists()) {
    // El usuario existe en Auth pero no en Firestore → sin perfil
    console.warn("SIGEP: Usuario sin perfil en Firestore. Redirigiendo al login.");
    await auth.signOut();
    location.href = "/login.html";
    return;
  }

  const operadorData = operadorSnap.data();
  const rol = operadorData.rol || "operador";

  // Guardar en el objeto global para uso de los controladores
  window.SIGEP.user    = user;
  window.SIGEP.rol     = rol;
  window.SIGEP.perfil  = operadorData;

  // Verificar si el rol tiene acceso a esta página
  const rolesPermitidos = PERMISOS[paginaActual];
  if (rolesPermitidos && !rolesPermitidos.includes(rol)) {
    alert(`Acceso denegado. Tu rol (${rol}) no tiene permiso para ver esta página.`);
    location.href = "/dashboard.html";
    return;
  }

  // Despachar evento para que layout.js y el controlador sepan
  // que la sesión está lista
  document.dispatchEvent(new CustomEvent("sigep:auth-ready", {
    detail: { user, rol, perfil: operadorData }
  }));
});
