const fs = require('node:fs');
const path = require('node:path');

const expoRoot = path.dirname(require.resolve('expo/package.json'));
const podspecPath = path.join(
  expoRoot,
  'node_modules',
  'expo-constants',
  'ios',
  'EXConstants.podspec',
);

if (!fs.existsSync(podspecPath)) {
  console.warn('[the-wall] Expo Constants podspec was not found; path-space patch skipped.');
  process.exit(0);
}

const source = fs.readFileSync(podspecPath, 'utf8');
const original = ':script => "bash -l -c \\"#{env_vars}$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh\\"",';
const patched = ':script => "bash -l -c \\"#{env_vars}\\\\\\"$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh\\\\\\"\\"",';

if (source.includes(patched)) {
  process.exit(0);
}

if (!source.includes(original)) {
  console.warn('[the-wall] Expo Constants build script changed; path-space patch skipped.');
  process.exit(0);
}

fs.writeFileSync(podspecPath, source.replace(original, patched));
console.log('[the-wall] Patched Expo Constants to support project paths containing spaces.');
