# SmartPot

SmartPot je full-stack IoT aplikácia na monitorovanie izbových rastlín pomocou **ESP32** a webového rozhrania. Sleduje **vlhkosť pôdy**, **teplotu**, **vlhkosť vzduchu** a **svetlo**, zobrazuje históriu meraní v grafoch, upozorňuje na problémy a ponúka **AI analýzu stavu rastliny**.

Projekt obsahuje:
- **frontend** v Reacte + Vite
- **backend** v Node.js + Express
- **Supabase PostgreSQL** ako databázu
- **ESP32 firmware** pre zber dát zo senzorov
- **Web Push notifikácie** a PWA podporu
- **AI odporúčania** cez Groq s fallbackom na Gemini

---

## Čo aplikácia aktuálne vie

### Dashboard
- prehľad všetkých rastlín na jednej obrazovke
- health score z poslednej AI analýzy
- rýchly status rastliny a zariadenia
- počet neprečítaných alertov pri rastline
- responzívne karty pre desktop aj mobil

### Detail rastliny
- aktuálne hodnoty všetkých metrík
- prepínanie medzi metrikami: pôda, teplota, vzduch, svetlo
- história meraní za **6h / 12h / 24h / 48h**
- zvýraznené offline zóny zariadenia v grafe
- zoom a posun grafu na desktope aj mobile
- záznam manuálneho polievania
- úprava a zmazanie rastliny
- AI analýza stavu rastliny
- smart sekcia s odporúčaním polievania:
  - odhad do ďalšieho polievania
  - trend vlhkosti
  - reakcia senzora po poslednom poliatí

### Alerty
- samostatná stránka alertov
- označenie alertov ako prečítané
- zoskupenie alertov podľa rastliny
- kategorizované rozbaliteľné sekcie

### Notifikácie
- Web Push notifikácie pre prehliadač / PWA
- test subscription priamo cez backend
- pravidelný digest problémov
- samostatné notifikácie pri zmene stavu zariadenia:
  - zariadenie je offline
  - zariadenie je online
- stručné texty notifikácií typu:
  - `Kaktus potrebuje pozornosť`
  - `Treba poliať (14% pôda)`

### Mobilné UI
- responzívny layout pre iPhone aj Android
- kompaktné karty a zhutnené sekcie na mobile
- mobilný hamburger navbar
- bottom-sheet edit modal fungujúci korektne aj na mobilných zariadeniach
- jemné animácie pri načítaní stránok a sekcií

---

## Architektúra

```text
ESP32 + senzory
   │
   ▼
Backend API (Node.js / Express)
   │            ├─ AI analýza (Groq / Gemini fallback)
   │            ├─ Web Push scheduler
   │            └─ Azure IoT Hub listener
   ▼
Supabase (PostgreSQL)
   │
   ▼
Frontend (React / Vite / Tailwind / Recharts)
```

### Použité technológie

**Frontend**
- React 18
- Vite 5
- React Router DOM
- Tailwind CSS
- Recharts
- Lucide React
- Axios

**Backend**
- Node.js 18+
- Express
- Supabase JS client
- Helmet
- CORS
- Morgan
- express-rate-limit
- web-push
- Azure Event Hubs klient

**Databáza a služby**
- Supabase PostgreSQL
- Groq API
- Gemini API (fallback)
- Azure IoT Hub / Event Hub compatible endpoint

**Hardware**
- ESP32
- DHT22
- Capacitive Soil Moisture Sensor
- BH1750

---

## Štruktúra projektu

```text
smartpot-main/
├── backend/
│   ├── models/
│   ├── routes/
│   ├── services/
│   ├── utils/
│   ├── server.js
│   └── supabase-migration.sql
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── services/
│   │   └── utils/
│   └── vite.config.js
├── esp32/
│   └── smart_plant_pot/
├── docs/
└── docker-compose.yml
```

---

## Hlavné route a stránky

### Frontend stránky
- `/` – dashboard rastlín
- `/plant/:id` – detail rastliny
- `/add` – pridanie novej rastliny
- `/alerts` – alerty a notifikácie

### Backend API
- `/api/plants` – CRUD rastlín a watering log
- `/api/sensors` – ingest, história, latest reading, status zariadenia
- `/api/ai` – AI analýza a návrh thresholdov
- `/api/dashboard` – overview a alerty
- `/api/notifications` – push konfigurácia, subscribe, unsubscribe, test
- `/api/health` – healthcheck

---

## Lokálne spustenie

### Požiadavky
- Node.js **18+**
- npm
- Supabase projekt
- aspoň jeden AI kľúč:
  - Groq API key, alebo
  - Gemini API key
- voliteľne Azure IoT Hub
- voliteľne VAPID kľúče pre Web Push

### 1. Rozbalenie a inštalácia

```bash
cd smartpot-main
```

### 2. Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

Backend štandardne beží na:
- `http://localhost:3001`

### 3. Frontend

V novom termináli:

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Frontend štandardne beží na:
- `http://localhost:5173`

---

## Konfigurácia prostredia

### Backend `.env`

Súbor: `backend/.env`

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key

# AI
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

### Frontend `.env`

Súbor: `frontend/.env`

```env
VITE_API_URL=http://localhost:3001/api
```

---

## Databáza

1. Vytvor Supabase projekt.
2. Otvor SQL Editor.
3. Spusť obsah súboru:
   - `backend/supabase-migration.sql`
4. Doplň `SUPABASE_URL`, `SUPABASE_ANON_KEY` a `SUPABASE_SERVICE_KEY` do `.env`.

Voliteľne môžeš doplniť testovacie dáta:

```bash
cd backend
npm run seed
```

---

## Docker

Projekt obsahuje jednoduchý `docker-compose.yml` pre frontend a backend.

```bash
docker-compose up --build
```

Po spustení:
- frontend: `http://localhost:5173`
- backend: `http://localhost:3001`

Poznámka: databáza nie je súčasťou compose stacku, používa sa externý Supabase projekt.

---

## ESP32 firmware

Firmware je v:
- `esp32/smart_plant_pot/smart_plant_pot.ino`

Postup:
1. otvor súbor v Arduino IDE
2. nainštaluj potrebné knižnice podľa kódu
3. nastav Wi‑Fi údaje, `DEVICE_ID` a API / IoT endpoint
4. nahraj sketch do ESP32

Projekt je pripravený na posielanie dát cez Azure IoT Hub pipeline aj backend spracovanie.

---

## PWA a push notifikácie

Frontend obsahuje:
- `manifest.webmanifest`
- `sw.js`
- ikony pre PWA
- klientsku logiku pre registráciu push subscription

### iPhone / iOS poznámka
Web Push na iPhone funguje spoľahlivo cez **PWA nainštalovanú na plochu**. To znamená:
1. otvoriť appku v Safari
2. zvoliť **Pridať na plochu**
3. aplikáciu spúšťať z ikony na ploche

---

## Skripty

### Backend

```bash
npm run dev     # vývojový režim s nodemon
npm start       # produkčné spustenie
npm run seed    # seed testovacích dát
npm run lint    # eslint
npm run check   # lint + základná kontrola
```

### Frontend

```bash
npm run dev      # Vite dev server
npm run build    # produkčný build
npm run preview  # preview buildu
npm run lint     # eslint
npm run check    # lint + build
```

---

## Nasadenie

Projekt je pripravený na nasadenie po častiach:
- **frontend** napr. cez Vercel, Netlify, Cloud Run alebo vlastný Nginx
- **backend** napr. Azure App Service, Render, Railway, VPS
- **databáza** cez Supabase

Ak chceš použiť pôvodný cloud split deployment:
- frontend → Google Cloud Run
- backend → Azure App Service
- databáza → Supabase
- IoT ingest → Azure IoT Hub

---

## Aktuálny stav projektu

V tejto verzii sú už zapracované aj viaceré UX vylepšenia:
- minimalistickejší navbar
- zlepšené mobilné rozloženie
- animované načítanie stránok a sekcií
- prepracovaný detail rastliny
- smart watering insights
- opravy grafov pri offline úsekoch
- upravené alerty a push notifikácie

---

## Ďalší rozvoj

Odporúčané ďalšie kroky:
- kalibrácia senzora vlhkosti pôdy cez wizard
- device health panel (Wi‑Fi, heartbeat, uptime, firmware)
- 7d / 30d pohľady na trendy
- lepšia detekcia reakcie senzora po poliatí
- autentifikácia používateľov a multi-user režim
- export histórie meraní

---

## Dokumentácia

Podrobnejšia dokumentácia je v súbore:
- `docs/DOKUMENTACIA.md`

---

## Licencia

Školský / osobný projekt.
