# Control Uñas — Caja diaria

App web mobile-first para registrar lo que deja cada clienta en el día y repartir el total en porcentajes (insumos, ganancia, y una meta personalizable, ej. "comprar televisor").

Dos partes:
- **backend/** → API en Node + Express + SQLite (guarda todo en un archivo, no necesita un servidor de base de datos aparte)
- **frontend/** → App en React + Vite, pensada para abrirse desde el celular

---

## 1. Correrla en tu PC (para probar)

### Backend

```bash
cd backend
npm install
npm start
```

Va a levantar en `http://localhost:3001`. La base de datos se crea sola en `backend/data/control-unas.db`.

### Frontend

En otra terminal:

```bash
cd frontend
npm install
npm run dev
```

Va a levantar en `http://localhost:5173`. Abrila en el navegador — por defecto ya apunta al backend local.

Para probarla desde tu celular en la misma wifi: fijate la IP de tu PC (`ipconfig` o `ifconfig`) y entrá desde el celu a `http://TU-IP:5173`.

---

## 2. Ponerla en producción (para que la clienta la use desde su celular)

Plan elegido: **Fly.io** para el backend (gratis, con disco persistente) + **Vercel** para el frontend (gratis) + dominio **.com.ar gratis** en nic.ar.

### Backend en Fly.io

```bash
curl -L https://fly.io/install.sh | sh
cd backend
fly auth login
fly launch          # detecta el Dockerfile solo. Cuando pregunte por Postgres/Redis: no.
fly volumes create control_unas_data --size 1 --region eze
```

Editá el `fly.toml` que se generó y agregá:
```toml
[mounts]
  source = "control_unas_data"
  destination = "/app/data"
```

Deployá:
```bash
fly deploy
```

Te va a quedar una URL tipo `https://control-unas.fly.dev`.

### Frontend en Vercel

En `frontend/.env.production`:
```
VITE_API_URL=https://tu-app.fly.dev
```

```bash
npm install -g vercel
cd frontend
vercel --prod
```

### Dominio gratis (.com.ar)

Registralo en [nic.ar](https://nic.ar) con tu DNI. Después, en Vercel: **Settings → Domains**, agregás el dominio y cargás los registros DNS que te indique en el panel de nic.ar.

### Agregar a la pantalla de inicio del celu
Una vez deployada, la clienta entra desde Chrome/Safari, toca el menú (⋮ o compartir) → **"Agregar a pantalla de inicio"**. Le queda como un ícono más, abre a pantalla completa sin barra del navegador.

---

## 3. Estructura

```
control-unas/
├── backend/
│   ├── server.js          # arranca la API
│   ├── db.js               # conexión e inicialización de SQLite
│   └── routes/
│       ├── entries.js      # altas/bajas de clientas por día
│       └── config.js       # guarda el reparto por porcentajes
└── frontend/
    └── src/
        ├── App.jsx          # toda la pantalla
        ├── api.js           # llamadas al backend
        └── styles.css
```

## 4. Ideas para más adelante
- Login simple con PIN (como en VentasAPP) si vas a tener varias empleadas cargando
- Exportar el resumen del mes a Excel/PDF
- Notificación automática cuando se llega a la meta del "otro %"
