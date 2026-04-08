-- ============================================================
-- SmartPot Auth Migration
-- Spusti v Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ============================================================

-- 1. Pridaj user_id do plants
ALTER TABLE plants ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- 2. Tabuľka user_devices — prepojenie user ↔ zariadenie
CREATE TABLE IF NOT EXISTS user_devices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  claimed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(device_id)
);

CREATE INDEX IF NOT EXISTS idx_user_devices_user ON user_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_user_devices_device ON user_devices(device_id);
CREATE INDEX IF NOT EXISTS idx_plants_user ON plants(user_id);

-- 3. RLS policies
ALTER TABLE plants ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_devices ENABLE ROW LEVEL SECURITY;

-- Plants: user vidí/upravuje len svoje
DROP POLICY IF EXISTS "Users manage own plants" ON plants;
CREATE POLICY "Users manage own plants" ON plants
  FOR ALL USING (user_id = auth.uid());

-- Plants: service role (backend) má plný prístup
DROP POLICY IF EXISTS "Service role full access plants" ON plants;
CREATE POLICY "Service role full access plants" ON plants
  FOR ALL USING (auth.role() = 'service_role');

-- User devices: user vidí len svoje
DROP POLICY IF EXISTS "Users manage own devices" ON user_devices;
CREATE POLICY "Users manage own devices" ON user_devices
  FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Service role full access devices" ON user_devices;
CREATE POLICY "Service role full access devices" ON user_devices
  FOR ALL USING (auth.role() = 'service_role');

-- Sensor readings: ostáva bez RLS (backend filtruje cez device_id)
-- Alerts: ostáva bez RLS (backend filtruje cez plant/device)

-- 4. Ak máš existujúce dáta bez user_id, môžeš ich priradiť:
-- UPDATE plants SET user_id = 'YOUR-USER-UUID-HERE' WHERE user_id IS NULL;
