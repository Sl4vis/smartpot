/**
 * Azure IoT Hub Listener
 * Číta správy z IoT Hub (Event Hub endpoint) a ukladá do Supabase.
 * 
 * Potrebný env: AZURE_IOT_HUB_EVENT_HUB_CONNECTION_STRING
 * Nájdeš v Azure Portal → IoT Hub → Built-in endpoints → Event Hub-compatible endpoint
 */

const { EventHubConsumerClient } = require('@azure/event-hubs');
const { supabase } = require('../models/supabase');

let client = null;
let subscription = null;

async function startIoTHubListener() {
  const connectionString = process.env.AZURE_IOT_HUB_EVENT_HUB_CONNECTION_STRING;

  if (!connectionString) {
    console.log('⚠️  AZURE_IOT_HUB_EVENT_HUB_CONNECTION_STRING nie je nastavený — IoT Hub listener vypnutý');
    return;
  }

  try {
    client = new EventHubConsumerClient('$Default', connectionString);

    subscription = client.subscribe({
      processEvents: async (events) => {
        for (const event of events) {
          try {
            const data = event.body;
            console.log(`📡 IoT Hub správa od ${data.device_id || 'neznáme'}:`, JSON.stringify(data));

            // Ulož do Supabase
            if (data.device_id) {
              const reading = {
                device_id: data.device_id,
                soil_moisture: parseFloat(data.soil_moisture) || 0,
                temperature: parseFloat(data.temperature) || 0,
                humidity: parseFloat(data.humidity) || 0,
                light_lux: parseFloat(data.light_lux) || 0,
                created_at: new Date().toISOString()
              };

              const { error } = await supabase
                .from('sensor_readings')
                .insert(reading);

              if (error) {
                console.error('❌ Supabase insert chyba:', error.message);
              } else {
                console.log(`✅ Uložené meranie pre ${data.device_id}`);
              }

              // Skontroluj prahové hodnoty
              await checkThresholds(data.device_id, reading);
            }
          } catch (err) {
            console.error('❌ Chyba pri spracovaní IoT správy:', err.message);
          }
        }
      },
      processError: async (err) => {
        console.error('❌ IoT Hub listener chyba:', err.message);
      }
    });

    console.log('🌐 Azure IoT Hub listener beží — čakám na správy z ESP32...');
  } catch (err) {
    console.error('❌ Nepodarilo sa pripojiť na IoT Hub:', err.message);
  }
}

async function checkThresholds(deviceId, reading) {
  try {
    const { data: plant } = await supabase
      .from('plants').select('*').eq('device_id', deviceId).single();

    if (!plant) return;
    const alerts = [];

    if (reading.soil_moisture < (plant.min_soil_moisture || 30)) {
      alerts.push({
        device_id: deviceId, plant_id: plant.id, type: 'low_moisture',
        message: `Nízka vlhkosť pôdy: ${reading.soil_moisture}% (minimum: ${plant.min_soil_moisture}%)`,
        severity: 'warning'
      });
    }
    if (reading.temperature > (plant.max_temperature || 35)) {
      alerts.push({
        device_id: deviceId, plant_id: plant.id, type: 'high_temperature',
        message: `Vysoká teplota: ${reading.temperature}°C (maximum: ${plant.max_temperature}°C)`,
        severity: 'warning'
      });
    }
    if (reading.light_lux < (plant.min_light || 200)) {
      alerts.push({
        device_id: deviceId, plant_id: plant.id, type: 'low_light',
        message: `Málo svetla: ${reading.light_lux} lux (minimum: ${plant.min_light} lux)`,
        severity: 'info'
      });
    }

    if (alerts.length > 0) {
      await supabase.from('alerts').insert(alerts);
    }
  } catch (err) {
    console.error('Threshold check error:', err.message);
  }
}

async function stopIoTHubListener() {
  if (subscription) await subscription.close();
  if (client) await client.close();
  console.log('IoT Hub listener zastavený');
}

module.exports = { startIoTHubListener, stopIoTHubListener };
