# 🌱 Smart Plant Pot

Webová aplikácia na monitorovanie izbových rastlín pomocou ESP32 senzorového modulu. Aplikácia sleduje vlhkosť pôdy, teplotu, vlhkosť vzduchu a intenzitu svetla v reálnom čase, ukladá históriu meraní a poskytuje AI-generované odporúčania pre starostlivosť o rastliny.

## Architektúra

```
ESP32 (senzory)
    │
    ▼  HTTP/MQTT
Azure IoT Hub
    │
    ▼  Event routing
Backend (Node.js/Express) ──── Azure App Service
    │           │
    │           ▼
    │     OpenAI API (AI odporúčania) ← iný provider
    │
    ▼
Supabase (PostgreSQL) ← ďalší provider
    │
    ▼
Frontend (React/Vite) ──── Google Cloud Run
```

### Splnené požiadavky zadania

| Požiadavka | Riešenie |
|---|---|
| Frontend hosting | Google Cloud Run |
| Backend hosting | Azure App Service |
| Databáza | Supabase (PostgreSQL) |
| Externá služba od iného providera | OpenAI API (AI odporúčania) |
| IoT zariadenie | ESP32 + DHT22 + soil moisture + BH1750 |
| AI komponent | OpenAI GPT pre analýzu stavu rastliny |
| Min. 4 služby | ✅ Google Cloud + Azure + Supabase + OpenAI |

## Rýchly štart (lokálne)

### Predpoklady
- Node.js 18+
- npm alebo yarn
- Supabase účet (free tier)
- OpenAI API kľúč

### 1. Klonuj repozitár
```bash
git clone <url-repozitara>
cd smart-plant-pot
```

### 2. Nastav databázu (Supabase)
1. Vytvor nový projekt na [supabase.com](https://supabase.com)
2. Spusti SQL migráciu z `backend/supabase-migration.sql`
3. Skopíruj URL a anon key

### 3. Backend
```bash
cd backend
cp .env.example .env
# Uprav .env s tvojimi credentials
npm install
npm run dev
```

### 4. Frontend
```bash
cd frontend
cp .env.example .env
# Uprav .env - nastav VITE_API_URL
npm install
npm run dev
```

### 5. ESP32
1. Otvor `esp32/smart_plant_pot.ino` v Arduino IDE
2. Nainštaluj knižnice (pozri komentáre v kóde)
3. Uprav WiFi credentials a backend URL
4. Nahraj na ESP32

## Docker (lokálne)
```bash
docker-compose up --build
```

## Nasadenie na cloud

### Backend → Azure App Service
```bash
cd backend
az webapp up --name smart-plant-pot-api --runtime "NODE:18-lts"
```

### Frontend → Google Cloud Run
```bash
cd frontend
npm run build
gcloud run deploy smart-plant-pot-web --source .
```

Podrobnejšie inštrukcie v `docs/DOKUMENTACIA.md`.

## Technológie

- **Frontend**: React 18, Vite, Recharts, Tailwind CSS
- **Backend**: Node.js, Express, Supabase JS Client
- **Databáza**: Supabase (PostgreSQL)
- **IoT**: ESP32, DHT22, Capacitive Soil Moisture, BH1750
- **AI**: OpenAI GPT-4o-mini
- **Cloud**: Azure App Service, Google Cloud Run, Azure IoT Hub

## Tím

| Meno | Rola | Zodpovednosti |
|---|---|---|
| **Člen 1 (Team Lead)** | Full-stack | Backend, cloud nasadenie, IoT |
| Člen 2 | Frontend | UI/UX, vizualizácie, responzívny dizajn |
| Člen 3 | IoT + AI | ESP32 firmware, AI integrácia, testovanie |

## Licencia
Školský projekt – TUKE 2026
