// The iOS URL scheme Google Sign-In calls back on is the iOS OAuth client id,
// reversed: "<id>.apps.googleusercontent.com" → "com.googleusercontent.apps.<id>".
// Derived from EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID (plugins/withGoogleSignInScheme.js), so the scheme and
// the client the app signs in with can't drift apart per environment.
//
// Strict: the whole value must have the Google iOS client id shape, with no
// whitespace anywhere (not even trailing — that is a config error, not trimmed),
// and the derived scheme is checked again before it is returned, so nothing
// malformed can reach Info.plist. Errors name the variable only, never its value.
const VAR = 'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID';
const CLIENT_ID = /^([0-9]+-[a-z0-9]+)\.apps\.googleusercontent\.com$/;
const SCHEME = /^com\.googleusercontent\.apps\.[0-9]+-[a-z0-9]+$/;

function reversedClientIdScheme(clientId) {
  if (typeof clientId !== 'string' || clientId.trim() === '') {
    throw new Error(`${VAR} is not set: the Google Sign-In iOS URL scheme is derived from it (see .env.example and the EAS environment).`);
  }
  const match = CLIENT_ID.exec(clientId);
  if (!match) {
    throw new Error(
      `${VAR} is not a valid Google iOS OAuth client id (expected "<digits>-<lowercase letters and digits>.apps.googleusercontent.com", no spaces).`,
    );
  }
  const scheme = `com.googleusercontent.apps.${match[1]}`;
  if (!SCHEME.test(scheme)) throw new Error(`${VAR} produced an invalid Google Sign-In URL scheme.`);
  return scheme;
}

module.exports = { reversedClientIdScheme };
