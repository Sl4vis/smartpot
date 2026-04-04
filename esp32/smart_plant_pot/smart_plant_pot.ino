#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <BH1750.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BME280.h>
#include <time.h>

#include "mbedtls/base64.h"
#include "mbedtls/md.h"

// ═══════════════════════════════════════════════════════
// KONFIGURÁCIA
// ═══════════════════════════════════════════════════════

// WiFi
const char* WIFI_SSID     = "Mariana smart";
const char* WIFI_PASSWORD = "95181394";

// Azure IoT Hub
const char* AZURE_IOT_HUB_HOST = "ESP32-Smartpot.azure-devices.net";
const char* DEVICE_ID          = "esp32-001";
const char* DEVICE_KEY         = "KUubBAay5LcOnPpjy63Mh+fSAxpt60ntwo2VqaYD7kU=";

// Interval merania v sekundách
const int MEASURE_INTERVAL = 60;

// SAS token platnosť
const long SAS_TOKEN_VALID_SECS = 3600;

// ═══════════════════════════════════════════════════════
// PINY A KALIBRÁCIA
// ═══════════════════════════════════════════════════════
const int soilPin = 34;
const int dryValue = 2620;
const int wetValue = 2000;

#define LED_PIN 2
#define I2C_SDA 21
#define I2C_SCL 22

// ═══════════════════════════════════════════════════════
// OBJEKTY
// ═══════════════════════════════════════════════════════
BH1750 lightMeter;
Adafruit_BME280 bme;
WiFiClientSecure secureClient;
PubSubClient mqttClient(secureClient);

// MQTT detaily
String mqttUsername;
String mqttClientId;
String mqttPassword;
String mqttPublishTopic;

// Token refresh
unsigned long sasExpiryEpoch = 0;

// ═══════════════════════════════════════════════════════
// POMOCNÉ FUNKCIE
// ═══════════════════════════════════════════════════════

String urlEncode(const String &msg) {
  const char *hex = "0123456789ABCDEF";
  String encoded = "";

  for (size_t i = 0; i < msg.length(); i++) {
    char c = msg.charAt(i);

    if (isalnum((unsigned char)c) || c == '-' || c == '_' || c == '.' || c == '~') {
      encoded += c;
    } else {
      encoded += '%';
      encoded += hex[(c >> 4) & 0xF];
      encoded += hex[c & 0xF];
    }
  }

  return encoded;
}

String base64Encode(const uint8_t *input, size_t length) {
  size_t outputLen = 0;
  mbedtls_base64_encode(nullptr, 0, &outputLen, input, length);

  unsigned char output[outputLen + 1];
  if (mbedtls_base64_encode(output, sizeof(output), &outputLen, input, length) != 0) {
    return "";
  }

  output[outputLen] = '\0';
  return String((char*)output);
}

bool base64Decode(const String &input, uint8_t *output, size_t outputSize, size_t &outputLen) {
  return mbedtls_base64_decode(
           output,
           outputSize,
           &outputLen,
           (const unsigned char*)input.c_str(),
           input.length()
         ) == 0;
}

String hmacSHA256Base64(const String &keyBase64, const String &message) {
  uint8_t decodedKey[128];
  size_t decodedKeyLen = 0;

  if (!base64Decode(keyBase64, decodedKey, sizeof(decodedKey), decodedKeyLen)) {
    Serial.println("Base64 decode key failed");
    return "";
  }

  unsigned char hmacResult[32];
  mbedtls_md_context_t ctx;
  const mbedtls_md_info_t *mdInfo = mbedtls_md_info_from_type(MBEDTLS_MD_SHA256);

  mbedtls_md_init(&ctx);

  if (mbedtls_md_setup(&ctx, mdInfo, 1) != 0) {
    mbedtls_md_free(&ctx);
    return "";
  }

  if (mbedtls_md_hmac_starts(&ctx, decodedKey, decodedKeyLen) != 0 ||
      mbedtls_md_hmac_update(&ctx, (const unsigned char*)message.c_str(), message.length()) != 0 ||
      mbedtls_md_hmac_finish(&ctx, hmacResult) != 0) {
    mbedtls_md_free(&ctx);
    return "";
  }

  mbedtls_md_free(&ctx);

  return base64Encode(hmacResult, sizeof(hmacResult));
}

String generateSasToken(long expiry) {
  String resourceUri = String(AZURE_IOT_HUB_HOST) + "/devices/" + DEVICE_ID;
  String encodedResourceUri = urlEncode(resourceUri);

  String stringToSign = encodedResourceUri + "\n" + String(expiry);
  String signature = hmacSHA256Base64(String(DEVICE_KEY), stringToSign);

  if (signature.length() == 0) {
    return "";
  }

  String encodedSignature = urlEncode(signature);

  String sasToken = "SharedAccessSignature sr=" + encodedResourceUri +
                    "&sig=" + encodedSignature +
                    "&se=" + String(expiry);

  return sasToken;
}

void syncTime() {
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");

  Serial.print("Synchronizing time");
  time_t now = time(nullptr);
  int attempts = 0;

  while (now < 1700000000 && attempts < 30) {
    delay(500);
    Serial.print(".");
    now = time(nullptr);
    attempts++;
  }

  if (now >= 1700000000) {
    Serial.println("\nTime synchronized.");
    Serial.print("Epoch time: ");
    Serial.println((long)now);
  } else {
    Serial.println("\nFailed to sync time.");
  }
}

void buildAzureMqttConfig() {
  mqttClientId = DEVICE_ID;
  mqttUsername = String(AZURE_IOT_HUB_HOST) + "/" + DEVICE_ID + "/?api-version=2021-04-12";
  mqttPublishTopic = "devices/" + String(DEVICE_ID) + "/messages/events/";

  time_t now = time(nullptr);
  sasExpiryEpoch = now + SAS_TOKEN_VALID_SECS;
  mqttPassword = generateSasToken(sasExpiryEpoch);

  Serial.println("Azure MQTT config prepared.");
}

void connectWiFi() {
  Serial.printf("Pripajam sa na WiFi: %s", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\nWiFi connected! IP: %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\nWiFi connection failed. Restarting...");
    ESP.restart();
  }
}

bool connectAzureMQTT() {
  if (WiFi.status() != WL_CONNECTED) {
    return false;
  }

  if (time(nullptr) < 1700000000) {
    syncTime();
  }

  if (mqttPassword.length() == 0 || time(nullptr) >= (time_t)(sasExpiryEpoch - 60)) {
    buildAzureMqttConfig();
  }

  if (mqttClient.connected()) {
    return true;
  }

  Serial.println("Connecting to Azure IoT Hub MQTT...");

  mqttClient.setServer(AZURE_IOT_HUB_HOST, 8883);

  // Pre prvý test. Keď to rozbeháš, môžeme doplniť CA certifikát.
  secureClient.setInsecure();

  bool ok = mqttClient.connect(
    mqttClientId.c_str(),
    mqttUsername.c_str(),
    mqttPassword.c_str()
  );

  if (ok) {
    Serial.println("Connected to Azure IoT Hub.");
    return true;
  } else {
    Serial.print("MQTT connect failed, rc=");
    Serial.println(mqttClient.state());
    return false;
  }
}

void ensureAzureConnection() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  if (!mqttClient.connected()) {
    connectAzureMQTT();
  }

  mqttClient.loop();
}

bool sendDataToAzure(float soilMoisture, float temperature, float humidity, float lightLux, float pressure) {
  ensureAzureConnection();

  if (!mqttClient.connected()) {
    Serial.println("Azure MQTT not connected. Telemetry not sent.");
    return false;
  }

  StaticJsonDocument<256> doc;
  doc["device_id"] = DEVICE_ID;
  doc["soil_moisture"] = round(soilMoisture * 10) / 10.0;
  doc["temperature"] = round(temperature * 10) / 10.0;
  doc["humidity"] = round(humidity * 10) / 10.0;
  doc["light_lux"] = round(lightLux * 10) / 10.0;
  doc["pressure"] = round(pressure * 10) / 10.0;

  String jsonPayload;
  serializeJson(doc, jsonPayload);

  Serial.print("Publishing to Azure: ");
  Serial.println(jsonPayload);

  bool ok = mqttClient.publish(mqttPublishTopic.c_str(), jsonPayload.c_str());

  if (ok) {
    Serial.println("Telemetry sent to Azure IoT Hub.");
  } else {
    Serial.println("Publish failed.");
  }

  return ok;
}

// ═══════════════════════════════════════════════════════
// SETUP
// ═══════════════════════════════════════════════════════
void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n=============================");
  Serial.println("Smart Plant Pot - ESP32 + Azure IoT Hub");
  Serial.println("=============================\n");

  analogReadResolution(12);
  pinMode(soilPin, INPUT);
  pinMode(LED_PIN, OUTPUT);

  Wire.begin(I2C_SDA, I2C_SCL);

  if (lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE)) {
    Serial.println("BH1750 initialized successfully.");
  } else {
    Serial.println("Error initializing BH1750.");
  }

  bool bmeStatus = bme.begin(0x76);
  if (!bmeStatus) {
    bmeStatus = bme.begin(0x77);
  }

  if (bmeStatus) {
    Serial.println("BME280 initialized successfully.");
  } else {
    Serial.println("Error initializing BME280.");
  }

  connectWiFi();
  syncTime();
  buildAzureMqttConfig();
  connectAzureMQTT();

  Serial.println();
}

// ═══════════════════════════════════════════════════════
// LOOP
// ═══════════════════════════════════════════════════════
void loop() {
  ensureAzureConnection();

  digitalWrite(LED_PIN, HIGH);

  int rawValue = analogRead(soilPin);
  int moisturePercent = map(rawValue, dryValue, wetValue, 0, 100);
  moisturePercent = constrain(moisturePercent, 0, 100);

  float lux = lightMeter.readLightLevel();
  float temperature = bme.readTemperature();
  float humidity = bme.readHumidity();
  float pressure = bme.readPressure() / 100.0F;

  if (isnan(temperature) || isnan(humidity) || isnan(lux)) {
    Serial.println("Warning: sensor read failed, retrying...");
    delay(2000);

    lux = lightMeter.readLightLevel();
    temperature = bme.readTemperature();
    humidity = bme.readHumidity();
    pressure = bme.readPressure() / 100.0F;
  }

  Serial.println("------ SENSOR DATA ------");

  Serial.print("Soil raw: ");
  Serial.println(rawValue);

  Serial.print("Soil moisture: ");
  Serial.print(moisturePercent);
  Serial.println("%");

  Serial.print("Light: ");
  Serial.print(lux);
  Serial.println(" lux");

  Serial.print("Temperature: ");
  Serial.print(temperature);
  Serial.println(" °C");

  Serial.print("Air humidity: ");
  Serial.print(humidity);
  Serial.println(" %");

  Serial.print("Pressure: ");
  Serial.print(pressure);
  Serial.println(" hPa");
  Serial.println();

  if (!isnan(temperature) && !isnan(humidity) && !isnan(lux)) {
    sendDataToAzure(moisturePercent, temperature, humidity, lux, pressure);
  } else {
    Serial.println("Data not sent - invalid sensor values.");
  }

  digitalWrite(LED_PIN, LOW);

  unsigned long waitMs = MEASURE_INTERVAL * 1000UL;
  unsigned long startMs = millis();
  while (millis() - startMs < waitMs) {
    mqttClient.loop();
    delay(10);
  }
}