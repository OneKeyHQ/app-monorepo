import platformEnv from '../platformEnv';

export function isLocalSecretEnvelopeKeyLossDevBuild() {
  return (
    platformEnv.isLocalDevelopmentBuild === true &&
    !platformEnv.isProduction &&
    !platformEnv.isE2E
  );
}
