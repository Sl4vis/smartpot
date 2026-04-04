# Dokumentácia - Smart Plant Pot

## 1. Rozbor a analýza úlohy

### 1.1 Popis problematiky
Aplikácia "Smart Plant Pot" slúži na automatizované monitorovanie stavu izbových rastlín pomocou IoT senzorov. Hlavným cieľom je poskytnúť používateľovi prehľad o podmienkach, v ktorých sa jeho rastlina nachádza, a na základe AI analýzy odporučiť optimálne kroky starostlivosti.

### 1.2 Funkcionálne požiadavky
- Zber dát z ESP32 senzorového modulu (vlhkosť pôdy, teplota, vlhkosť vzduchu, svetlo)
- Ukladanie meraní do databázy
- Vizualizácia aktuálnych hodnôt a histórie na webovom dashboarde
- Automatické upozornenia pri prekročení prahových hodnôt
- AI-generované odporúčania pre starostlivosť o rastlinu (OpenAI GPT)
- Zaznamenávanie polievania
- Správa viacerých rastlín

### 1.3 Nefunkcionálne požiadavky
- Responzívny dizajn (mobil + desktop)
- Nízka latencia zobrazenia dát
- Bezpečnosť API (rate limiting, CORS, helmet)
- Nasaditeľnosť na cloud (Docker)

---

## 2. Odôvodnenie zvolených technológií

### Frontend: React + Vite + Tailwind CSS
- **React 18**: Najpopulárnejší frontend framework, komponentový prístup, veľký ekosystém
- **Vite**: Moderný build tool, rýchly HMR (hot module replacement)
- **Tailwind CSS**: Utility-first CSS, rýchle prototypovanie, konzistentný dizajn
- **Recharts**: Deklaratívna knižnica na grafy, natívna integrácia s Reactom

### Backend: Node.js + Express
- **Express**: Jednoduchý, overený HTTP framework
- **Modularita**: Oddelené route súbory pre senzory, rastliny, AI, dashboard
- **Bezpečnosť**: Helmet, CORS, Rate Limiting

### Databáza: Supabase (PostgreSQL)
- **Prečo Supabase**: Hostovaný PostgreSQL s REST API, real-time subscriptions, free tier
- **Prečo nie Firebase**: Relačná databáza lepšie vyhovuje štruktúrovaným senzorovým dátam
- **Provider**: Supabase je samostatný provider (nie Azure, nie GCP)

### AI služba: OpenAI GPT-4o-mini
- **Účel**: Analýza stavu rastliny na základe senzorových dát a generovanie odporúčaní
- **Prečo OpenAI**: Kvalitné jazykové modely, jednoduché REST API, podpora JSON response
- **Provider**: OpenAI je iný provider ako hosting (Azure/GCP) → spĺňa podmienku zadania

### IoT: ESP32 + senzory
- **ESP32**: Populárny mikrokontrolér s WiFi, nízka cena (~5€), Arduino kompatibilný
- **DHT22**: Teplota + vlhkosť vzduchu
- **Capacitive Soil Moisture Sensor v2.0**: Vlhkosť pôdy (odolnejší ako rezistívny)
- **BH1750**: Digitálny svetelný senzor (I2C)

### Cloud hosting
- **Backend → Azure App Service**: PaaS, jednoduchý deployment cez Azure CLI
- **Frontend → Google Cloud Run**: Kontajnerový PaaS, auto-scaling, free tier
- **Alternatíva**: Oboje na Azure + Docker Compose

---

## 3. Diagram použitých služieb

```
┌─────────────────────────────────────────────────────────────┐
│                     POUŽÍVATEĽ                              │
│                   (webový prehliadač)                        │
└─────────────────────┬───────────────────────────────────────┘
                      │ HTTPS
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              GOOGLE CLOUD RUN                               │
│         Frontend (React/Vite/Nginx)                         │
│         - Dashboard, grafy, formuláre                       │
└─────────────────────┬───────────────────────────────────────┘
                      │ REST API (HTTPS)
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              MICROSOFT AZURE                                │
│         Azure App Service                                   │
│         Backend (Node.js/Express)                           │
│         - API endpointy                                     │
│         - Senzorové dáta processing                         │
│         - Alert systém                                      │
├─────────────────────┬──────────────────┬────────────────────┤
│                     │                  │                    │
│    ┌────────────────▼──┐    ┌─────────▼──────────┐         │
│    │   SUPABASE        │    │   OPENAI API       │         │
│    │   (PostgreSQL)    │    │   (GPT-4o-mini)    │         │
│    │                   │    │                    │         │
│    │  - sensor_readings│    │  - Analýza zdravia │         │
│    │  - plants         │    │  - Odporúčania     │         │
│    │  - alerts         │    │  - JSON response   │         │
│    │  - watering_log   │    │                    │         │
│    │  - ai_analyses    │    │  Provider: OpenAI  │         │
│    │                   │    └────────────────────┘         │
│    │  Provider:Supabase│                                   │
│    └───────────────────┘                                   │
└────────────────────────────────────┬───────────────────────┘
                                     │ HTTP POST
                                     │ (každých 60s)
                      ┌──────────────┴───────────────┐
                      │      ESP32 Dev Module         │
                      │                               │
                      │  ┌─────────┐ ┌──────────────┐│
                      │  │  DHT22  │ │ Soil Moisture ││
                      │  │ T + H   │ │  Capacitive  ││
                      │  └─────────┘ └──────────────┘│
                      │  ┌─────────┐                  │
                      │  │ BH1750  │                  │
                      │  │ Svetlo  │                  │
                      │  └─────────┘                  │
                      │     Provider: Fyzické HW      │
                      └───────────────────────────────┘

Zhrnutie providerov:
  1. Google Cloud (frontend hosting)
  2. Microsoft Azure (backend hosting)
  3. Supabase (databáza - tretí provider)
  4. OpenAI (AI služba - štvrtý provider)
```

---

## 4. Príspevok jednotlivých členov tímu

### Člen 1 – Team Lead (Backend + Cloud)
- Návrh architektúry a API endpointov
- Implementácia backend servera (Express, routes, middleware)
- Integrácia so Supabase (modely, migrácie)
- Nasadenie na Azure App Service
- Docker konfigurácia
- Git repozitár a CI/CD

### Člen 2 – Frontend
- Návrh UI/UX dizajnu
- Implementácia React komponentov (Dashboard, PlantDetail, AddPlant, Alerts)
- Vizualizácia dát (Recharts grafy, gauge komponenty)
- Responzívny layout (Tailwind CSS)
- Nasadenie na Google Cloud Run

### Člen 3 – IoT + AI
- ESP32 firmware (Arduino)
- Zapojenie a kalibrácia senzorov (DHT22, soil moisture, BH1750)
- Integrácia OpenAI API (AI service)
- Testovanie end-to-end komunikácie ESP32 → Backend → Frontend
- Dokumentácia

---

## 5. Dokumentácia k používaniu aplikácie

### 5.1 Požiadavky
- **Node.js** 18+ a npm
- **Arduino IDE** 2.x s ESP32 board support
- **Supabase** účet (free tier: supabase.com)
- **OpenAI** API kľúč (platform.openai.com)
- **Hardware**: ESP32 Dev Module, DHT22, Capacitive Soil Moisture Sensor, BH1750

### 5.2 Inštalácia a spustenie (lokálne)

#### Databáza
1. Vytvorte nový projekt na [supabase.com](https://supabase.com)
2. Otvorte SQL Editor
3. Skopírujte a spustite obsah `backend/supabase-migration.sql`
4. Poznačte si `Project URL` a `anon`/`service_role` kľúč (Settings → API)

#### Backend
```bash
cd backend
cp .env.example .env
# Otvorte .env a vyplňte:
#   SUPABASE_URL=https://xxxxx.supabase.co
#   SUPABASE_SERVICE_KEY=eyJ...
#   OPENAI_API_KEY=sk-...
#   FRONTEND_URL=http://localhost:5173
npm install
npm run dev
# Backend beží na http://localhost:3001
```

#### Frontend
```bash
cd frontend
cp .env.example .env
# VITE_API_URL=http://localhost:3001/api
npm install
npm run dev
# Frontend beží na http://localhost:5173
```

#### ESP32
1. Otvorte `esp32/smart_plant_pot.ino` v Arduino IDE
2. Nainštalujte knižnice: DHT sensor library, BH1750, ArduinoJson
3. Nastavte board: ESP32 Dev Module
4. Upravte `WIFI_SSID`, `WIFI_PASSWORD`, `API_URL` a `DEVICE_ID`
5. Zapojte senzory podľa schémy v kóde
6. Nahrajte na ESP32

### 5.3 Docker
```bash
cd smart-plant-pot
# Vytvorte backend/.env
docker-compose up --build
# Frontend: http://localhost:5173
# Backend:  http://localhost:3001
```

### 5.4 Nasadenie na cloud

#### Backend → Azure
```bash
cd backend
az login
az webapp up --name smart-plant-pot-api --runtime "NODE:18-lts" --sku F1
az webapp config appsettings set --name smart-plant-pot-api \
  --settings SUPABASE_URL=... SUPABASE_SERVICE_KEY=... OPENAI_API_KEY=... \
  FRONTEND_URL=https://smart-plant-pot-web-xxxxx.a.run.app NODE_ENV=production
```

#### Frontend → Google Cloud Run
```bash
cd frontend
# Upravte .env: VITE_API_URL=https://smart-plant-pot-api.azurewebsites.net/api
npm run build
gcloud run deploy smart-plant-pot-web \
  --source . \
  --allow-unauthenticated \
  --region europe-west1
```

### 5.5 API Endpointy

| Metóda | Endpoint | Popis |
|--------|----------|-------|
| GET | /api/health | Health check |
| POST | /api/sensors | Prijať dáta z ESP32 |
| GET | /api/sensors/:deviceId/latest | Posledné meranie |
| GET | /api/sensors/:deviceId/history?hours=24 | História meraní |
| GET | /api/plants | Zoznam rastlín |
| POST | /api/plants | Vytvor rastlinu |
| PUT | /api/plants/:id | Uprav rastlinu |
| DELETE | /api/plants/:id | Zmaž rastlinu |
| POST | /api/plants/:id/water | Zaznamenaj polievanie |
| POST | /api/ai/analyze/:plantId | AI analýza |
| GET | /api/dashboard/overview | Prehľad |
| GET | /api/dashboard/alerts | Upozornenia |

### 5.6 Vstupy a výstupy

**Vstup z ESP32** (POST /api/sensors):
```json
{
  "device_id": "esp32-001",
  "soil_moisture": 55.2,
  "temperature": 22.4,
  "humidity": 58.0,
  "light_lux": 850.0
}
```

**Výstup AI analýzy** (POST /api/ai/analyze/:id):
```json
{
  "health_score": 82,
  "status": "ok",
  "summary": "Rastlina je v dobrom stave. Vlhkosť pôdy je optimálna.",
  "recommendations": [
    {
      "priority": "low",
      "action": "Pokračujte v aktuálnom režime polievania",
      "reason": "Všetky parametre sú v norme."
    }
  ],
  "watering_needed": false,
  "next_watering_hours": 12
}
```
