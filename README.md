# SIGEP — Sistema Inteligente de Gestión de Estacionamientos y Parqueaderos
## UrbanPark S.A. — Documentación de Despliegue

---

## Requisitos Previos

- [Node.js](https://nodejs.org/) v18 o superior
- [Firebase CLI](https://firebase.google.com/docs/cli): `npm install -g firebase-tools`
- Cuenta de Google con acceso al proyecto **`examenprogramacionweb2`**

---

## Estructura del Proyecto

```
/ExamenProgramacionWeb2/
├── public/                  ← Frontend (HTML + CSS + JS Vanilla)
│   ├── css/styles.css       ← Estilos originales + extensiones
│   ├── js/
│   │   ├── firebase-config.js   ← SDK Firebase v9 modular
│   │   ├── auth-guard.js        ← Protección de rutas por rol
│   │   ├── layout.js            ← Inyección de header/nav/footer
│   │   └── views/               ← Controlador por vista (15 archivos)
│   ├── components/          ← Parciales HTML compartidos
│   │   ├── header.html
│   │   ├── nav.html
│   │   └── footer.html
│   ├── index.html           ← Entry point (redirige según auth)
│   ├── login.html
│   ├── dashboard.html
│   ├── buscador.html
│   ├── vehiculos.html
│   ├── espacios.html
│   ├── tickets.html
│   ├── operadores.html
│   ├── reportes.html
│   ├── carga-masiva.html
│   ├── perfil.html
│   ├── cierre-caja.html
│   ├── auditoria.html
│   ├── comprobante.html
│   ├── idioma-voz.html
│   └── sorpresa.html
├── firestore.rules          ← Reglas de seguridad Firestore
├── storage.rules            ← Reglas de seguridad Storage
├── firebase.json            ← Configuración de despliegue
└── firestore.indexes.json
```

---

## Modelo de Datos Firestore

### Colecciones

| Colección       | Descripción                                    |
|-----------------|------------------------------------------------|
| `parqueaderos`  | Sedes/sucursales de UrbanPark S.A.             |
| `vehiculos`     | Registro de vehículos con fotos en Storage     |
| `espacios`      | Plazas de estacionamiento con estado actual    |
| `tickets`       | Transacciones (check-in / check-out)           |
| `operadores`    | Empleados. El ID del documento = UID de Auth   |
| `tarifas`       | Precios por tipo de espacio                    |
| `auditoria`     | Bitácora inmutable de acciones sensibles       |
| `cajas`         | Registros de cierre de caja por turno          |

### Roles del sistema (campo `rol` en `operadores/{uid}`)

| Valor          | Descripción                                    |
|----------------|------------------------------------------------|
| `super_admin`  | Acceso total a todas las sedes                 |
| `supervisor`   | Reportes + gestión de operadores               |
| `operador`     | Caja, check-in/out, perfil propio              |

---

## Cómo Ejecutar Localmente

### Opción 1: Firebase Hosting Emulator (recomendado)

```bash
# 1. Iniciar sesión en Firebase
firebase login

# 2. Seleccionar el proyecto
firebase use examenprogramacionweb2

# 3. Iniciar el emulador de hosting
firebase emulators:start --only hosting
```

El sitio estará disponible en `http://localhost:5000`

### Opción 2: Servidor HTTP Simple

```bash
# Desde la carpeta public/
npx serve public
# o
python -m http.server 8080 --directory public
```

> ⚠️ Con esta opción, los módulos ES (import/export) funcionan
> si el servidor sirve archivos con MIME type `application/javascript`.

---

## Despliegue en Producción

### 1. Instalar Firebase CLI
```bash
npm install -g firebase-tools
firebase login
```

### 2. Seleccionar el proyecto
```bash
firebase use examenprogramacionweb2
```

### 3. Desplegar todo
```bash
firebase deploy
```

### 4. Desplegar solo partes específicas
```bash
firebase deploy --only hosting
firebase deploy --only firestore:rules
firebase deploy --only storage
```

---

## Primer Usuario (Super Administrador)

Antes de que alguien pueda iniciar sesión, necesitas crear el primer
super_admin manualmente en Firebase Console:

1. Ve a **Firebase Console → Authentication → Add user**
2. Crea el usuario con el correo y contraseña del administrador
3. Copia el UID generado
4. Ve a **Firebase Console → Firestore → Colección `operadores`**
5. Crea un documento con ID = el UID copiado, con estos campos:
   ```json
   {
     "nombres": "Nombre del Admin",
     "apellidos": "Apellido",
     "correo": "admin@urbanpark.com",
     "rol": "super_admin",
     "cargo": "supervisor",
     "turno": "matutino",
     "cedula_identidad": "1234567890",
     "activo": true,
     "fecha_registro": "(timestamp actual)"
   }
   ```
6. A partir de ahí, el super_admin puede crear otros operadores
   desde la interfaz web.

---

## Datos de Semilla (Seed) Recomendados

Para iniciar el sistema, crea también:

### Parqueaderos
```json
{
  "nombre": "Sede Centro 1",
  "direccion": "Av. Principal y Calle 10",
  "capacidad_total": 240,
  "activo": true
}
```

### Tarifas iniciales
```json
{ "tipo_espacio": "estandar",       "precio_por_hora": 1.50, "activo": true }
{ "tipo_espacio": "motos",          "precio_por_hora": 0.80, "activo": true }
{ "tipo_espacio": "electrico",      "precio_por_hora": 2.00, "activo": true }
{ "tipo_espacio": "discapacitados", "precio_por_hora": 0.75, "activo": true }
```

---

## Librerías Externas Utilizadas (CDN, sin instalación)

| Librería        | Versión | Uso                                      |
|-----------------|---------|------------------------------------------|
| Firebase SDK    | 10.12.2 | Auth, Firestore, Storage                 |
| Chart.js        | 4.4.0   | Gráficas del dashboard                   |
| SheetJS (xlsx)  | 0.20.1  | Exportación a Excel (.xlsx)              |
| jsPDF           | 2.5.1   | Generación de PDFs en el navegador       |
| qrcode.js       | 1.5.3   | Generación de códigos QR                 |
| Google Fonts    | —       | Fuentes: Oswald, Inter, IBM Plex Mono    |

---

## Seguridad

- Las reglas de Firestore (`firestore.rules`) verifican el rol del usuario
  leyendo su documento en `operadores/{uid}` antes de cada operación.
- El `auth-guard.js` del frontend redirige a `login.html` si el usuario
  no está autenticado o no tiene el rol necesario para la vista.
- Las contraseñas nunca se almacenan en Firestore, solo en Firebase Auth.
- Los archivos CSV de carga masiva se procesan directamente en el navegador
  con `FileReader`; no pasan por un servidor.

---

## Soporte

Para dudas sobre el sistema, contactar al equipo de desarrollo de UrbanPark S.A.

© 2026 UrbanPark S.A. — SIGEP. Todos los derechos reservados.
