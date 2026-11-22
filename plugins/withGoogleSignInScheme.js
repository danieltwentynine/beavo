// Google Sign-In's iOS callback URL scheme, derived from the iOS OAuth client id
// the app signs in with (EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID), so the two can't drift.
// Replaces the library plugin's hand-typed `iosUrlScheme` (that plugin, without a
// Firebase plist, only adds this one Info.plist URL scheme).
//
// The variable is read inside the Info.plist mod, which runs only at prebuild /
// native build. Reading the config (`expo config`, `eas init`, `eas build`
// before the build starts) never needs it, so EAS commands that read config
// without .env files (EXPO_NO_DOTENV) keep working. A native build without it
// fails loudly, naming the variable and never its value.
const { IOSConfig, withInfoPlist } = require('expo/config-plugins');

const { reversedClientIdScheme } = require('./googleScheme');

/** Add the derived scheme to an Info.plist object (pure; exported for tests). */
function applyGoogleScheme(infoPlist, clientId) {
  const scheme = reversedClientIdScheme(clientId);
  return IOSConfig.Scheme.hasScheme(scheme, infoPlist) ? infoPlist : IOSConfig.Scheme.appendScheme(scheme, infoPlist);
}

const withGoogleSignInScheme = (config) =>
  withInfoPlist(config, (cfg) => {
    cfg.modResults = applyGoogleScheme(cfg.modResults, process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID);
    return cfg;
  });

module.exports = withGoogleSignInScheme;
module.exports.applyGoogleScheme = applyGoogleScheme;
