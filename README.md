<div align="center">

# 🪴 SmartPot

**Monitoruj svoje izbové rastliny cez ESP32 a zisti, kedy naozaj treba poliať — nie kedy si myslíš, že treba.**

Full-stack IoT aplikácia, ktorá zbiera dáta zo senzorov v kvetináči, kreslí z nich históriu a cez AI ti povie, v akom stave rastlina je.

[![Node](https://img.shields.io/badge/node-%3E%3D18-3ECF8E?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![React](https://img.shields.io/badge/react-18-58A6FF?style=flat-square&logo=react&logoColor=white)](https://react.dev)
[![Supabase](https://img.shields.io/badge/supabase-postgres-3ECF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com)
[![ESP32](https://img.shields.io/badge/esp32-firmware-E7352C?style=flat-square&logo=espressif&logoColor=white)](https://www.espressif.com)
[![PWA](https://img.shields.io/badge/PWA-web%20push-58A6FF?style=flat-square)](https://web.dev/progressive-web-apps/)

</div>

---

> [!NOTE]
> Sem pridaj screenshot alebo GIF dashboardu. Podľa štatistík je to jediná vec, ktorá zvýši
> počet ľudí, čo si projekt naozaj skúsia, viac než akýkoľvek text.

## Obsah

- [Prečo SmartPot](#prečo-smartpot)
- [Funkcie](#funkcie)
- [Rýchly štart](#rýchly-štart)
- [Konfigurácia](#konfigurácia)
- [Architektúra](#architektúra)
- [API referencia](#api-referencia)
- [ESP32 firmware](#esp32-firmware)
- [Nasadenie](#nasadenie)
- [Roadmap](#roadmap)
- [Prispievanie](#prispievanie)
- [Licencia](#licencia)
- [Kontakt](#kontakt)

---

## Prečo SmartPot

Bežné vlhkomery do kvetináča ukazujú jedno číslo a nič si nepamätajú. SmartPot rieši tri veci navyše:

- **História namiesto okamihu** — vidíš trend za 48 hodín, nie jeden údaj
- **Odhad namiesto hádania** — smart watering ti povie, koľko dní zostáva do ďalšieho polievania na základe skutočnej krivky vysychania
- **Notifikácia namiesto kontrolovania** — push príde do telefónu, keď rastlina alebo zariadenie potrebujú pozornosť

Sleduje **vlhkosť pôdy**, **teplotu**, **vlhkosť vzduchu** a **osvetlenie**.

---

## Funkcie

| Oblasť | Čo to vie |
|---|---|
| **Dashboard** | Prehľad všetkých rastlín, health score z AI analýzy, status zariadenia, počet neprečítaných alertov |
| **Detail rastliny** | Grafy za 6/12/24/48 h, prepínanie metrík, zoom a posun, zvýraznené offline zóny |
| **Smart watering** | Odhad do ďalšieho polievania, trend vlhkosti, overenie reakcie senzora po poliatí |
| **AI analýza** | Vyhodnotenie stavu rastliny cez Groq, s automatickým fallbackom na Gemini |
| **Alerty** | Samostatná stránka, zoskupenie podľa rastliny, označovanie ako prečítané |
| **Web Push** | Notifikácie do prehliadača aj PWA, pravidelný digest, upozornenie na offline/online zariadenie |
| **Mobil** | Responzívny layout, hamburger navbar, bottom-sheet edit modal |

<details>
<summary><b>Podrobný rozpis funkcií</b></summary>

### Dashboard
- prehľad všetkých rastlín na jednej obrazovke
- health score z poslednej AI analýzy
- rýchly status rastliny a zariadenia
- počet neprečítaných alertov pri rastline
- responzívne karty pre desktop aj mobil

### Detail rastliny
- aktuálne hodnoty všetkých metrík
- prepínanie medzi metrikami: pôda, teplota, vzduch, svetlo
- história meraní za 6h / 12h / 24h / 48h
- zvýraznené offline zóny zariadenia v grafe
- zoom a posun grafu na desktope aj mobile
- záznam manuálneho polievania
- úprava a zmazanie rastliny

### Notifikácie
- test subscription priamo cez backend
- pravidelný digest problémov
- samostatné notifikácie pri zmene stavu zariadenia
- stručné texty typu `Kaktus potrebuje pozornosť` alebo `Treba poliať (14% pôda)`

</details>

---

## Rýchly štart

### Požiadavky

| Nutné | Voliteľné |
|---|---|
| Node.js 18+ a npm | Azure IoT Hub |
| Supabase projekt | VAPID kľúče pre Web Push |
| Groq **alebo** Gemini API kľúč | ESP32 s pripojenými senzormi |

Bez ESP32 sa aplikácia spustí tiež — dáta si naplň cez `npm run seed`.

### 1. Databáza

Vytvor Supabase projekt, otvor **SQL Editor** a spusti obsah `backend/supabase-migration.sql`.

### 2. Backend

```bash
cd backend
cp .env.example .env      # doplň Supabase a AI kľúče
npm install
npm run seed              # voliteľné: testovacie dáta
npm run dev
```

Beží na `http://localhost:3001`.

### 3. Frontend

V novom termináli:

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Otvor `http://localhost:5173`.

### Alternatíva: Docker

```bash
docker-compose up --build
```

> [!IMPORTANT]
> Databáza nie je súčasťou compose stacku — aj v Dockeri sa používa externý Supabase projekt.

### Overenie

```bash
curl http://localhost:3001/api/health
```

---

## Konfigurácia

<details>
<summary><b>backend/.env</b></summary>

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key

# AI (stačí jeden, Gemini slúži ako fallback)
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

## Architektúra

```text
ESP32 + senzory (DHT22, capacitive soil, BH1750)
   │
   ▼
Backend API (Node.js / Express)
   ├─ AI analýza (Groq → Gemini fallback)
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
<summary><b>Technológie a štruktúra priečinkov</b></summary>

**Frontend:** React 18 · Vite 5 · React Router DOM · Tailwind CSS · Recharts · Lucide React · Axios

**Backend:** Express · Supabase JS client · Helmet · CORS · Morgan · express-rate-limit · web-push · Azure Event Hubs

**Služby:** Supabase PostgreSQL · Groq API · Gemini API · Azure IoT Hub

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

## API referencia

| Endpoint | Účel |
|---|---|
| `GET /api/health` | Healthcheck |
| `/api/plants` | CRUD rastlín a watering log |
| `/api/sensors` | Ingest dát, história, posledné meranie, status zariadenia |
| `/api/ai` | AI analýza stavu a návrh thresholdov |
| `/api/dashboard` | Overview a alerty |
| `/api/notifications` | Push konfigurácia, subscribe, unsubscribe, test |

**Frontend routes:** `/` dashboard · `/plant/:id` detail · `/add` nová rastlina · `/alerts` alerty

Podrobná dokumentácia: [`docs/DOKUMENTACIA.md`](docs/DOKUMENTACIA.md)

---

## ESP32 firmware

Sketch: `esp32/smart_plant_pot/smart_plant_pot.ino`

1. Otvor v Arduino IDE
2. Nainštaluj knižnice podľa hlavičky súboru
3. Nastav Wi-Fi údaje, `DEVICE_ID` a API / IoT endpoint
4. Nahraj do ESP32

Firmware vie posielať dáta cez Azure IoT Hub pipeline aj priamo do backendu.

---

## Nasadenie

Projekt sa nasadzuje po častiach:

| Časť | Kde |
|---|---|
| Frontend | Vercel, Netlify, Cloud Run, vlastný Nginx |
| Backend | Azure App Service, Render, Railway, VPS |
| Databáza | Supabase |
| IoT ingest | Azure IoT Hub |

<details>
<summary><b>Push notifikácie na iPhone</b></summary>

Web Push na iOS funguje spoľahlivo len cez PWA nainštalovanú na plochu:

1. Otvor appku v Safari
2. Zvoľ **Pridať na plochu**
3. Spúšťaj ju z ikony na ploche, nie zo Safari

</details>

<details>
<summary><b>npm skripty</b></summary>

**Backend:** `npm run dev` · `npm start` · `npm run seed` · `npm run lint` · `npm run check`

**Frontend:** `npm run dev` · `npm run build` · `npm run preview` · `npm run lint` · `npm run check`

</details>

---

## Roadmap

- [ ] Kalibračný wizard pre senzor vlhkosti pôdy
- [ ] Device health panel (Wi-Fi, heartbeat, uptime, firmware)
- [ ] 7-dňové a 30-dňové pohľady na trendy
- [ ] Presnejšia detekcia reakcie senzora po poliatí
- [ ] Autentifikácia a multi-user režim
- [ ] Export histórie meraní

---

## Prispievanie

Pull requesty vítané. Pred väčšou zmenou otvor issue, nech si to najprv prejdeme.

1. Forkni repozitár a vytvor vetvu: `git checkout -b feature/nazov`
2. Pred commitom spusti `npm run check` v backende aj frontende
3. Commit správy píš v [Conventional Commits](https://www.conventionalcommits.org) formáte
4. Otvor pull request s popisom, čo sa mení a prečo

Chybu hlás cez [GitHub Issues](../../issues) — pridaj kroky na zopakovanie, očakávané a skutočné správanie.

---

## Licencia

Školský a osobný projekt. Kód je bez explicitnej licencie, čo znamená, že **všetky práva sú vyhradené** a nikto ho nesmie legálne používať ani forkovať.

> [!TIP]
> Ak chceš, aby si projekt mohli ľudia pozrieť a použiť, pridaj súbor `LICENSE` s MIT licenciou
> a nahraď tento odstavec riadkom: `MIT © Slavomír Hodor`.

---

## Kontakt

**Slavomír Hodor** — [GitHub @Sl4vis](https://github.com/Sl4vis) · [LinkedIn](https://www.linkedin.com/in/slavom%C3%ADr-hodor-6642ab36b/)

Otázky k projektu píš radšej do [Issues](../../issues), nech odpoveď nájdu aj ostatní.
