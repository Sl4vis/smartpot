<div align="center">

# 🪴 SmartPot

**Monitor your houseplants with an ESP32 and find out when they actually need water — not when you think they do.**

A full-stack IoT app that collects sensor data from the pot, charts its history, and uses AI to tell you how the plant is doing.

[![Node](https://img.shields.io/badge/node-%3E%3D18-3ECF8E?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![React](https://img.shields.io/badge/react-18-58A6FF?style=flat-square&logo=react&logoColor=white)](https://react.dev)
[![Supabase](https://img.shields.io/badge/supabase-postgres-3ECF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com)
[![ESP32](https://img.shields.io/badge/esp32-firmware-E7352C?style=flat-square&logo=espressif&logoColor=white)](https://www.espressif.com)
[![PWA](https://img.shields.io/badge/PWA-web%20push-58A6FF?style=flat-square)](https://web.dev/progressive-web-apps/)

</div>

---

> [!NOTE]
> Add a screenshot or GIF of the dashboard here. It will do more to get people to actually
> try the project than any amount of text.

## Contents

- [Why SmartPot](#why-smartpot)
- [Features](#features)
- [Quick start](#quick-start)
- [Configuration](#configuration)
- [Architecture](#architecture)
- [API reference](#api-reference)
- [ESP32 firmware](#esp32-firmware)
- [Deployment](#deployment)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)
- [Contact](#contact)

---

## Why SmartPot

An ordinary soil moisture meter shows a single number and remembers nothing. SmartPot adds three things on top:

- **History instead of a snapshot** — you see the trend over 48 hours, not one reading
- **Estimates instead of guesswork** — smart watering tells you how long until the next watering, based on the actual drying curve
- **Notifications instead of checking** — a push arrives on your phone when the plant or the device needs attention

It tracks **soil moisture**, **temperature**, **air humidity** and **light**.

---

## Features

| Area | What it does |
|---|---|
| **Dashboard** | Overview of all plants, health score from AI analysis, device status, unread alert count |
| **Plant detail** | Charts over 6/12/24/48 h, metric switching, zoom and pan, highlighted offline gaps |
| **Smart watering** | Estimate until next watering, moisture trend, sensor response check after watering |
| **AI analysis** | Plant health assessment via Groq, with automatic fallback to Gemini |
| **Alerts** | Dedicated page, grouped per plant, mark as read |
| **Web Push** | Browser and PWA notifications, periodic digest, device offline/online alerts |
| **Mobile** | Responsive layout, hamburger navbar, bottom-sheet edit modal |

<details>
<summary><b>Full feature breakdown</b></summary>

### Dashboard
- all plants on a single screen
- health score from the latest AI analysis
- quick plant and device status
- unread alert count per plant
- responsive cards for desktop and mobile

### Plant detail
- current values for every metric
- switch between metrics: soil, temperature, air, light
- measurement history over 6h / 12h / 24h / 48h
- device offline periods highlighted in the chart
- chart zoom and pan on both desktop and mobile
- manual watering log
- edit and delete a plant

### Notifications
- test subscription directly through the backend
- periodic digest of open problems
- separate notifications on device state change
- short notification copy such as `Cactus needs attention` or `Needs water (14% soil)`

</details>

---

## Quick start

### Requirements

| Required | Optional |
|---|---|
| Node.js 18+ and npm | Azure IoT Hub |
| A Supabase project | VAPID keys for Web Push |
| Groq **or** Gemini API key | ESP32 with sensors attached |

The app runs without an ESP32 — populate it with `npm run seed` instead.

### 1. Database

Create a Supabase project, open the **SQL Editor** and run the contents of `backend/supabase-migration.sql`.

### 2. Backend

```bash
cd backend
cp .env.example .env      # fill in Supabase and AI keys
npm install
npm run seed              # optional: sample data
npm run dev
```

Runs on `http://localhost:3001`.

### 3. Frontend

In a new terminal:

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Open `http://localhost:5173`.

### Alternative: Docker

```bash
docker-compose up --build
```

> [!IMPORTANT]
> The database is not part of the compose stack — Docker still uses an external Supabase project.

### Verify

```bash
curl http://localhost:3001/api/health
```

---

## Configuration

<details>
<summary><b>backend/.env</b></summary>

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key

# AI (one is enough, Gemini acts as fallback)
GROQ_API_KEY=your-groq-api-key
GEMINI_API_KEY=your-gemini-api-key

# Azure IoT Hub Event Hub endpoint
AZURE_IOT_HUB_EVENT_HUB_CONNECTION_STRING=Endpoint=sb://...

# Web Push
WEB_PUSH_VAPID_PUBLIC_KEY=your-public-vapid-key
WEB_PUSH_VAPID_PRIVATE_KEY=your-private-vapid-key
WEB_PUSH_SUBJECT=mailto:you@example.com
PUSH_DIGEST_INTERVAL_MINUTES=60
PUSH_SCHEDULER_INTERVAL_MINUTES=10
DEVICE_OFFLINE_AFTER_MINUTES=10

# Server
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

</details>

<details>
<summary><b>frontend/.env</b></summary>

```env
VITE_API_URL=http://localhost:3001/api
```

</details>

---

## Architecture

```text
ESP32 + sensors (DHT22, capacitive soil, BH1750)
   │
   ▼
Backend API (Node.js / Express)
   ├─ AI analysis (Groq → Gemini fallback)
   ├─ Web Push scheduler
   └─ Azure IoT Hub listener
   │
   ▼
Supabase (PostgreSQL)
   │
   ▼
Frontend (React / Vite / Tailwind / Recharts)
```

<details>
<summary><b>Tech stack and folder structure</b></summary>

**Frontend:** React 18 · Vite 5 · React Router DOM · Tailwind CSS · Recharts · Lucide React · Axios

**Backend:** Express · Supabase JS client · Helmet · CORS · Morgan · express-rate-limit · web-push · Azure Event Hubs

**Services:** Supabase PostgreSQL · Groq API · Gemini API · Azure IoT Hub

**Hardware:** ESP32 · DHT22 · Capacitive Soil Moisture Sensor · BH1750

```text
smartpot-main/
├── backend/
│   ├── models/  routes/  services/  utils/
│   ├── server.js
│   └── supabase-migration.sql
├── frontend/
│   └── src/ components/  services/  utils/
├── esp32/smart_plant_pot/
├── docs/
└── docker-compose.yml
```

</details>

---

## API reference

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | Health check |
| `/api/plants` | Plant CRUD and watering log |
| `/api/sensors` | Data ingest, history, latest reading, device status |
| `/api/ai` | Health analysis and threshold suggestions |
| `/api/dashboard` | Overview and alerts |
| `/api/notifications` | Push config, subscribe, unsubscribe, test |

**Frontend routes:** `/` dashboard · `/plant/:id` detail · `/add` new plant · `/alerts` alerts

Full documentation: [`docs/DOKUMENTACIA.md`](docs/DOKUMENTACIA.md)

---

## ESP32 firmware

Sketch: `esp32/smart_plant_pot/smart_plant_pot.ino`

1. Open it in the Arduino IDE
2. Install the libraries listed at the top of the file
3. Set your Wi-Fi credentials, `DEVICE_ID` and the API / IoT endpoint
4. Flash it to the ESP32

The firmware can send data through the Azure IoT Hub pipeline or straight to the backend.

---

## Deployment

The project deploys in parts:

| Part | Where |
|---|---|
| Frontend | Vercel, Netlify, Cloud Run, your own Nginx |
| Backend | Azure App Service, Render, Railway, VPS |
| Database | Supabase |
| IoT ingest | Azure IoT Hub |

<details>
<summary><b>Push notifications on iPhone</b></summary>

Web Push on iOS only works reliably through a PWA installed to the home screen:

1. Open the app in Safari
2. Tap **Add to Home Screen**
3. Launch it from the home screen icon, not from Safari

</details>

<details>
<summary><b>npm scripts</b></summary>

**Backend:** `npm run dev` · `npm start` · `npm run seed` · `npm run lint` · `npm run check`

**Frontend:** `npm run dev` · `npm run build` · `npm run preview` · `npm run lint` · `npm run check`

</details>

---

## Roadmap

- [ ] Calibration wizard for the soil moisture sensor
- [ ] Device health panel (Wi-Fi, heartbeat, uptime, firmware)
- [ ] 7-day and 30-day trend views
- [ ] More accurate sensor response detection after watering
- [ ] Authentication and multi-user mode
- [ ] Measurement history export

---

## Contributing

Pull requests are welcome. For anything substantial, open an issue first so we can talk it through.

1. Fork the repo and create a branch: `git checkout -b feature/name`
2. Run `npm run check` in both backend and frontend before committing
3. Write commit messages in [Conventional Commits](https://www.conventionalcommits.org) format
4. Open a pull request describing what changed and why

Report bugs through [GitHub Issues](../../issues) — include reproduction steps, expected behaviour and actual behaviour.

---

## License

School and personal project. The code carries no explicit license, which means **all rights are reserved** and nobody may legally use or fork it.

> [!TIP]
> If you want people to be able to try and reuse the project, add a `LICENSE` file with the MIT
> license and replace this paragraph with: `MIT © Slavomír Hodor`.

---

## Contact

**Slavomír Hodor** — [GitHub @Sl4vis](https://github.com/Sl4vis) · [LinkedIn](https://www.linkedin.com/in/slavom%C3%ADr-hodor-6642ab36b/)

For project questions, prefer [Issues](../../issues) so the answer is visible to everyone.
