const express = require('express');
const router = express.Router();
const {
  getPushConfig,
  isPushConfigured,
  savePushSubscription,
  disablePushSubscription,
  sendTestPush,
  sendScheduledPushDigests
} = require('../services/pushNotificationService');

router.get('/config', (req, res) => {
  res.json({ data: getPushConfig() });
});

router.post('/subscribe', async (req, res) => {
  try {
    if (!isPushConfigured()) {
      return res.status(503).json({ error: 'Web Push nie je nakonfigurovaný na serveri.' });
    }

    const { subscription, platform } = req.body || {};
    if (!subscription?.endpoint) {
      return res.status(400).json({ error: 'Chýba subscription endpoint.' });
    }

    const data = await savePushSubscription({
      subscription,
      userAgent: req.get('user-agent'),
      platform
    });

    res.json({
      data: {
        endpoint: data.endpoint,
        enabled: data.enabled,
        digest_interval_minutes: getPushConfig().digest_interval_minutes
      }
    });
  } catch (error) {
    console.error('Push subscribe error:', error.message);
    res.status(500).json({ error: 'Nepodarilo sa uložiť push subscription.' });
  }
});

router.post('/unsubscribe', async (req, res) => {
  try {
    const endpoint = req.body?.endpoint || req.body?.subscription?.endpoint;
    if (!endpoint) {
      return res.status(400).json({ error: 'Chýba endpoint subscription.' });
    }

    await disablePushSubscription(endpoint);
    res.json({ success: true });
  } catch (error) {
    console.error('Push unsubscribe error:', error.message);
    res.status(500).json({ error: 'Nepodarilo sa vypnúť push notification subscription.' });
  }
});

router.post('/test', async (req, res) => {
  try {
    if (!isPushConfigured()) {
      return res.status(503).json({ error: 'Web Push nie je nakonfigurovaný na serveri.' });
    }

    const subscription = req.body?.subscription;
    if (!subscription?.endpoint) {
      return res.status(400).json({ error: 'Chýba subscription endpoint.' });
    }

    await sendTestPush(subscription);
    res.json({ success: true });
  } catch (error) {
    console.error('Push test error:', error.message);
    const statusCode = error?.statusCode === 404 || error?.statusCode === 410 ? 410 : 500;
    res.status(statusCode).json({ error: 'Nepodarilo sa odoslať test push notifikáciu.' });
  }
});

router.post('/dispatch-now', async (req, res) => {
  try {
    await sendScheduledPushDigests();
    res.json({ success: true });
  } catch (error) {
    console.error('Push dispatch-now error:', error.message);
    res.status(500).json({ error: 'Nepodarilo sa spustiť okamžitý digest.' });
  }
});

module.exports = router;
