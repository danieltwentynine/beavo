// Beavo uses LOCAL notifications only (brushing reminders, src/data/reminders.ts):
// no push server and no push token. expo-notifications 57.0.x always adds the
// APNs entitlement (`aps-environment`) and ignores `enableRemoteNotifications`,
// so this plugin removes it again. Without the entitlement iOS can't hand the
// app a push token, which is the point (COPPA: a push token is a persistent
// identifier). Listed BEFORE expo-notifications in app.json: mods run in reverse
// order, so this one runs after expo-notifications has added the key.
// Checked by scripts/check-camera-guardrail.mjs (introspected entitlements).
const { withEntitlementsPlist } = require('expo/config-plugins');

module.exports = function withoutPushEntitlement(config) {
  return withEntitlementsPlist(config, (cfg) => {
    delete cfg.modResults['aps-environment'];
    return cfg;
  });
};
