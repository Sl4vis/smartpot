-- =====================================================
-- Smart Plant Pot - Supabase Migration
-- Spustiť v Supabase SQL Editor
-- =====================================================

-- Tabuľka rastlín
CREATE TABLE IF NOT EXISTS plants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  species VARCHAR(255),
  device_id VARCHAR(100) NOT NULL UNIQUE,
  location VARCHAR(255),
  image_url TEXT,
  emoji VARCHAR(10),
  min_soil_moisture FLOAT DEFAULT 30,
  max_soil_moisture FLOAT DEFAULT 80,
  min_temperature FLOAT DEFAULT 15,
  max_temperature FLOAT DEFAULT 30,
  min_light FLOAT DEFAULT 200,
  max_light FLOAT DEFAULT 10000,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Senzorové merania
CREATE TABLE IF NOT EXISTS sensor_readings (
  id BIGSERIAL PRIMARY KEY,
  device_id VARCHAR(100) NOT NULL,
  soil_moisture FLOAT NOT NULL DEFAULT 0,
  temperature FLOAT NOT NULL DEFAULT 0,
  humidity FLOAT NOT NULL DEFAULT 0,
  light_lux FLOAT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pre rýchle vyhľadávanie podľa device_id a času
CREATE INDEX IF NOT EXISTS idx_readings_device_time
  ON sensor_readings (device_id, created_at DESC);

-- História polievania
CREATE TABLE IF NOT EXISTS watering_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  plant_id UUID REFERENCES plants(id) ON DELETE CASCADE,
  amount_ml FLOAT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alerty
CREATE TABLE IF NOT EXISTS alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id VARCHAR(100) NOT NULL,
  plant_id UUID REFERENCES plants(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  severity VARCHAR(20) DEFAULT 'info',
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_device ON alerts (device_id, read, created_at DESC);

-- AI analýzy
CREATE TABLE IF NOT EXISTS ai_analyses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  plant_id UUID REFERENCES plants(id) ON DELETE CASCADE,
  health_score INTEGER,
  status VARCHAR(20),
  summary TEXT,
  recommendations JSONB,
  watering_needed BOOLEAN,
  raw_response JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger pre updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER plants_updated_at
  BEFORE UPDATE ON plants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS politiky (Row Level Security)
-- Pre jednoduchosť - povolíme všetko cez service key
ALTER TABLE plants ENABLE ROW LEVEL SECURITY;
ALTER TABLE sensor_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE watering_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_analyses ENABLE ROW LEVEL SECURITY;

-- Politiky pre service role (backend)
CREATE POLICY "Service role full access" ON plants FOR ALL USING (true);
CREATE POLICY "Service role full access" ON sensor_readings FOR ALL USING (true);
CREATE POLICY "Service role full access" ON watering_log FOR ALL USING (true);
CREATE POLICY "Service role full access" ON alerts FOR ALL USING (true);
CREATE POLICY "Service role full access" ON ai_analyses FOR ALL USING (true);

-- Vloženie testovacej rastliny
INSERT INTO plants (name, species, device_id, location, min_soil_moisture, max_soil_moisture, min_temperature, max_temperature, min_light)
VALUES ('Moja Monstera', 'Monstera deliciosa', 'esp32-001', 'Obývačka - okno', 40, 70, 18, 28, 300)
ON CONFLICT (device_id) DO NOTHING;

-- Push subscriptions pre web push notifikácie
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  endpoint TEXT NOT NULL UNIQUE,
  keys_p256dh TEXT,
  keys_auth TEXT,
  subscription_json JSONB NOT NULL,
  user_agent TEXT,
  platform VARCHAR(100),
  enabled BOOLEAN DEFAULT TRUE,
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_sent_at TIMESTAMPTZ,
  last_successful_send_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_enabled
  ON push_subscriptions (enabled, last_sent_at);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON push_subscriptions FOR ALL USING (true);

CREATE TRIGGER push_subscriptions_updated_at
  BEFORE UPDATE ON push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Pridanie emoji stĺpca (pre existujúce inštalácie)
ALTER TABLE plants ADD COLUMN IF NOT EXISTS emoji VARCHAR(10);
