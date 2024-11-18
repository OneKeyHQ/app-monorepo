import { captureException } from '@sentry/react-native';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { SectionPressItem } from './SectionPressItem';

export function SentryCrashSettings() {
  if (platformEnv.isNative) {
    return (
      <SectionPressItem
        title="Sentry Crash Test"
        onPress={() => {
          captureException(new Error('First error'));
        }}
      />
    );
  }
  return null;
}
