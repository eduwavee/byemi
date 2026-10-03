# by Emi · Caja, agenda y clientas de un salón de uñas

PWA hecha a medida para un salón de uñas real. Reemplaza el cuaderno y las notas del celular: cada cobro se anota en segundos, el total del día se reparte solo entre insumos, ganancia y una meta de ahorro, la agenda muestra los huecos libres de la semana y los recordatorios de turno, de service y de cumpleaños salen por WhatsApp con un toque.

Se instala en el celular como una app ("Agregar a pantalla de inicio"), sin pasar por ninguna tienda, y todo queda detrás de una clave de acceso. **No necesita servidor**: los datos se guardan en el propio celular, la app abre aunque no haya internet y no hay que pagar ningún hosting (solo la página, gratis en Vercel). El diseño es pastel y pensado para usarse con una mano entre clienta y clienta: barra de pestañas abajo, botones grandes y montos en pesos argentinos.

En producción: **[byemi.vercel.app](https://byemi.vercel.app)**

<p align="center">
  <img src="docs/celular-caja.jpg" width="200" alt="Caja: total del día, formulario para cargar un cobro con tipo de servicio y extras">
  <img src="docs/celular-agenda.jpg" width="200" alt="Agenda de la semana: turnos con seña, turnos atendidos y horarios libres">
  <img src="docs/celular-clientas.jpg" width="200" alt="Fichas de clientas: servicio habitual, visitas, cumpleaños, notas, fotos, próximo turno y WhatsApp">
  <img src="docs/celular-avisos.jpg" width="200" alt="Avisos: turnos de hoy, mañana y más adelante con botón Recordar por WhatsApp">
</p>

<p align="center">
  <img src="docs/celular-cobro-turno.jpg" width="200" alt="Cobro desde un turno: la Caja muestra la seña que dejó la clienta y cuánto falta cobrar">
  <img src="docs/celular-reparto.jpg" width="200" alt="Reparto del día en insumos, ganancia y meta, con gráfico de anillo y barra de progreso de la meta">
  <img src="docs/celular-resumen.jpg" width="200" alt="Resumen mensual: total, comparación con el mes anterior, gastos y desglose por servicio">
  <img src="docs/celular-ranking.jpg" width="200" alt="Ranking de clientas: las que más vienen y las que más invierten"><br>
  <sub>Cobro desde un turno, reparto con meta de ahorro, resumen mensual y ranking de clientas (datos de ejemplo).</sub>
</p>

---

## Qué hace

La app tiene cinco pestañas: **Caja**, **Agenda**, **Clientas**, **Avisos** y **Ajustes**.

**Caja**

| | |
|---|---|
| **Cobros del día** | Nombre de la clienta (opcional), tipo de servicio, extras y monto. Si hay precios cargados, el monto se completa solo (servicio + extras). Se navega día por día o se elige una fecha. |
| **Gastos** | Esmaltes, limas, lo que sea: se anotan aparte y se descuentan en el resumen. |
| **Reparto del día** | El total se divide en **Insumos**, **Ganancia** y una tercera parte con nombre propio (por ejemplo "Meta: Televisor"). Los porcentajes se editan y tienen que sumar 100 %. Un gráfico de anillo muestra cuánto va a cada lado. |
| **Meta de ahorro** | Se le pone un monto a la tercera parte y aparece una barra de progreso con lo acumulado y lo que falta. Se puede reiniciar cuando se cumple. |
| **Resumen** | Semanal o mensual: total cobrado, comparación con el período anterior, gastos, lo que queda (cobrado − gastos), desglose por tipo de servicio y por día. |
| **Historial** | Lista de todos los días con cobros, para volver a cualquiera. |

**Agenda**

| | |
|---|---|
| **Semana a la vista** | De lunes a domingo, con los turnos de cada día y los días que no se trabaja marcados. |
| **Horarios libres** | Calcula los huecos de cada día según el horario de trabajo y la duración de cada servicio (un Kapping ocupa 90 min, unas Esculpidas 120). Tocar un hueco abre un turno nuevo en ese horario. |
| **Turnos con seña** | Cada turno lleva clienta, día, hora, servicio y la seña que dejó. Se puede crear la clienta desde el mismo turno. |
| **"Vino" → cobrar** | Cuando la clienta llega, el turno pasa a la Caja con el nombre y el servicio cargados, y avisa cuánto falta cobrar descontando la seña. Al guardar el cobro, el turno queda como atendido. Si se borra el cobro, vuelve a pendiente. |

**Clientas**

| | |
|---|---|
| **Fichas** | Nombre, WhatsApp, servicio habitual, cumpleaños (día y mes, sin año) y notas: colores que le gustan, largo, forma, alergias. |
| **Fotos de trabajos** | Galería por clienta para recordar qué se hizo. Las fotos se achican en el celular antes de subirse (1400 px, JPEG). |
| **Historial automático** | Última visita, cantidad de visitas y total gastado se calculan solos cruzando las fichas con los cobros de la Caja. |
| **Ranking** | Las que más vienen, las que más invierten y las que hace más de 60 días que no vienen ni tienen turno, con un botón para escribirles. |
| **Búsqueda** | Por nombre, servicio o nota. Desde la ficha se agenda un turno directo. |

**Avisos**

| | |
|---|---|
| **Recordatorio de turno** | Turnos de hoy y mañana que todavía no tienen aviso. Un toque abre WhatsApp con el mensaje armado y el turno queda marcado como recordado. |
| **Les toca service** | Clientas que pasaron N días desde la última visita (21 por defecto) y no tienen turno. |
| **Cumpleaños** | Las que cumplen hoy y en los próximos 7 días, con un saludo listo (y un descuento, si se quiere). |
| **Mensajes editables** | Los tres textos se personalizan con variables: `{nombre}`, `{servicio}`, `{dia}`, `{hora}`, `{semanas}`. |
| **Contador** | La pestaña muestra un globito con la cantidad de avisos pendientes. |

**Ajustes**

| | |
|---|---|
| **Lista de precios** | Servicios (precio y duración) y extras (precio). En 0, el monto no se autocompleta. |
| **Horario de trabajo** | Hora de entrada y salida, y días que se trabaja. Lo usa la Agenda para calcular los huecos. |
| **Clave de acceso** | Se crea la primera vez que se abre la app y protege los datos si alguien agarra el celular. |
| **Backup** | Backup completo en JSON (con fotos) que se comparte a Drive, mail o WhatsApp, y planillas CSV (ingresos, gastos, clientas, turnos) que abren bien en Excel en español (separador `;` y acentos). Un aviso en la Caja recuerda hacerlo si pasó más de una semana. |
| **Celular nuevo** | "Cargar un backup" restaura todo en otro celular. También acepta el backup de la versión vieja con servidor. |

**Dónde quedan los datos**

- Todo se guarda en el celular, en la base local del navegador (IndexedDB): cobros, gastos, clientas, turnos, fotos y ajustes. Nada sale del teléfono salvo cuando se hace un backup.
- La app le pide al navegador almacenamiento persistente para que no borre los datos si falta espacio.
- Un service worker guarda la app misma, así que abre sin señal.
- La clave se guarda con PBKDF2 (150.000 iteraciones) y sal aleatoria. El backup no la incluye.
- Si el celular se pierde o se borra la app, los datos se van con él: por eso el backup semanal.

## Cómo funcionan los recordatorios por WhatsApp

No hace falta la API de WhatsApp Business ni ningún servicio pago. La app arma un link `https://wa.me/<número>?text=<mensaje>` con el mensaje ya completado; al tocarlo se abre WhatsApp en el celular con el chat de la clienta y el texto listo para mandar.

Los números se normalizan para Argentina: si se cargan como `11 2345 6789` o `011 2345-6789`, la app les agrega el `549` adelante.

## Estructura

```
frontend/                     PWA (React + Vite), sin backend
  index.html                  metadatos de PWA (iOS y Android)
  public/
    manifest.webmanifest      nombre, colores e íconos de la app instalada
    sw.js                     service worker: la app abre sin internet
    inspo/                    fotos de trabajos para la tira del inicio
  src/
    App.jsx                   clave, pestañas, estado compartido y aviso de backup
    Caja.jsx                  cobros, gastos, reparto, meta y resumen
    Agenda.jsx                semana, horarios libres y turnos
    Clientas.jsx              fichas, fotos y ranking
    Recordatorios.jsx         avisos de turno, service y cumpleaños
    Ajustes.jsx               backup y restauración, precios, horario y clave
    Login.jsx                 crear clave / ingresar
    db.js                     ⭐ base local (IndexedDB)
    api.js                    ⭐ toda la lógica de datos: cobros, resúmenes, clientas, turnos, export e import
    utils.js                  fechas, plata, WhatsApp y compresión de fotos
    inspo.js                  lista de fotos e Instagram del salón
    styles.css                ⭐ sistema visual pastel

docs/                         capturas para este README
```

Hecho con **React 18** y **Vite 5**, sin dependencias más allá de React. Sin frameworks de UI ni librerías de gráficos: el anillo del reparto es un `conic-gradient` de CSS y los íconos son SVG propios.

> Hasta octubre de 2026 la app tenía un backend (Node.js, Express y SQLite) que había que alojar en Render o Railway. Se reemplazó por la base local para no depender de un servidor pago; el código viejo quedó en el historial de git.

### Datos

| Almacén (IndexedDB) | Qué guarda |
|---|---|
| `entries` | Cobros: fecha, hora, clienta, servicio, extras y monto |
| `expenses` | Gastos: fecha, detalle y monto |
| `clients` | Fichas de clientas |
| `appointments` | Turnos, con seña y el cobro que los cerró |
| `photos` | Fotos de cada clienta (como imagen, dentro de la base) |
| `config` | Reparto, precios, horario, mensajes, fecha del último backup y la clave (hasheada) |

## Verlo en tu compu

Necesitás **Node.js 20 o superior**.

```bash
cd frontend
npm install
npm run dev
```

Después abrí <http://localhost:5173>. La primera vez la app pide crear una clave. Los datos de prueba quedan en ese navegador; para empezar de cero, borrá los datos del sitio desde las herramientas del navegador.

Como Vite escucha en toda la red (`host: true`), también se puede abrir desde el celular en la misma wifi con la IP de la compu, por ejemplo `http://192.168.0.10:5173`. Ojo: los datos que cargues así quedan en ese navegador, separados de la app publicada.

## Personalizar

- **Fotos del inicio:** guardá imágenes en `frontend/public/inspo/` como `01.jpg` … `06.jpg` (o cambiá la lista en `src/inspo.js`). Las que no existen se ocultan solas.
- **Instagram:** completá `INSTAGRAM_URL` e `INSTAGRAM_HANDLE` en `src/inspo.js` y aparece el link debajo de las fotos.
- **Íconos de la app:** agregá `icon-192.png` e `icon-512.png` en `frontend/public/` (los pide el `manifest.webmanifest`).
- **Servicios, precios, horario y mensajes:** se cambian desde la pestaña **Ajustes** y **Avisos**, sin tocar código.

## Publicar (gratis)

1. Importá el repo en Vercel con **Root Directory** `frontend` (Vite se detecta solo). No hace falta ninguna variable de entorno.
2. Push a `main`: Vercel publica solo.

Vercel (o Netlify, o GitHub Pages) sirve la página gratis; no hay servidor ni base de datos que pagar.

### Instalarla en el celular de la dueña

1. Abrir la URL en **Safari** (iPhone) o **Chrome** (Android).
2. **Compartir → Agregar a pantalla de inicio** (iPhone) o **Menú ⋮ → Instalar app** (Android).
3. Usarla siempre desde el ícono. En iPhone, la app instalada guarda sus datos aparte de Safari: lo que se cargue en una pestaña de Safari no aparece en la app, y viceversa.

### Pasar los datos de la versión con servidor

Si ya había datos en el backend viejo: antes de publicar esta versión, entrar a la app vieja y bajar **Ajustes → Backup completo**. Después, en la app nueva instalada en el celular, **Ajustes → Cargar un backup** y elegir ese archivo. Se pasan cobros, gastos, clientas, turnos y ajustes; las fotos no, porque el backup viejo no las incluía.

### Guía rápida para la dueña

1. Abrí el link de la app en **Safari** (iPhone) o **Chrome** (Android).
2. Instalala: **Compartir → Agregar a pantalla de inicio** (iPhone) o **⋮ → Instalar app** (Android).
3. Abrila **siempre desde el ícono**, nunca desde el navegador.
4. La primera vez creá tu clave. Si tenías datos anteriores: **Ajustes → Cargar un backup** y elegí el archivo que te pasaron.
5. **Todos los domingos:** **Ajustes → Backup completo** y mandátelo por WhatsApp o guardalo en Drive. Si cambiás o perdés el celular, con ese archivo recuperás todo.
6. No borres la app ni los datos de Safari/Chrome sin tener un backup reciente.

### Backups ✅

- Una vez por semana, **Ajustes → Backup completo** y guardar el archivo fuera del celular (Drive, mail, WhatsApp a sí misma). Incluye las fotos.
- Si pasó más de una semana, la Caja muestra un aviso.

## Próxima etapa

- Sincronizar entre dos celulares (hoy cada celular tiene sus propios datos).
- Varias profesionales en el mismo salón, cada una con su caja y su reparto.
- Vincular los cobros a la ficha por id, no por nombre.
- Envío automático de recordatorios (API de WhatsApp Business).

## Sobre el proyecto

Proyecto real hecho a medida para un cliente (salón de uñas), desarrollado en solitario de punta a punta: relevamiento con la dueña, arquitectura, desarrollo, despliegue y soporte.
