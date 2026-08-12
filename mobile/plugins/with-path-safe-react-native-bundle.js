const { withXcodeProject } = require('@expo/config-plugins');

const BUNDLE_PHASE_NAME = 'Bundle React Native code and images';
const LEGACY_COMMAND =
  '`\\"$NODE_BINARY\\" --print \\"require(\'path\').dirname(require.resolve(\'react-native/package.json\')) + \'/scripts/react-native-xcode.sh\'\\"`';
const PATH_SAFE_COMMAND =
  'REACT_NATIVE_XCODE_SCRIPT=\\"$(\\"$NODE_BINARY\\" --print \\"require(\'path\').dirname(require.resolve(\'react-native/package.json\')) + \'/scripts/react-native-xcode.sh\'\\")\\"\\n\\"$REACT_NATIVE_XCODE_SCRIPT\\"';

module.exports = function withPathSafeReactNativeBundle(config) {
  return withXcodeProject(config, (projectConfig) => {
    const phases = projectConfig.modResults.hash.project.objects.PBXShellScriptBuildPhase;
    const phase = Object.values(phases).find(
      (candidate) =>
        candidate &&
        typeof candidate === 'object' &&
        candidate.name?.replaceAll('"', '') === BUNDLE_PHASE_NAME,
    );

    if (!phase) {
      throw new Error(`Could not find the iOS build phase: ${BUNDLE_PHASE_NAME}`);
    }

    if (phase.shellScript.includes(PATH_SAFE_COMMAND)) {
      return projectConfig;
    }

    if (!phase.shellScript.includes(LEGACY_COMMAND)) {
      throw new Error('The React Native iOS bundle command changed; the path-safe patch needs updating.');
    }

    phase.shellScript = phase.shellScript.replace(LEGACY_COMMAND, PATH_SAFE_COMMAND);
    return projectConfig;
  });
};
