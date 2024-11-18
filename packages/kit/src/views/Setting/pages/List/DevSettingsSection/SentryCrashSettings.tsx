import { captureException, nativeCrash } from '@sentry/react-native';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { SectionPressItem } from './SectionPressItem';

function a() {
  throw new Error('Function not implemented.');
}

export function SentryCrashSettings() {
  if (platformEnv.isNative) {
    return (
      <>
        <SectionPressItem
          title="Sentry Crash Test"
          onPress={() => {
            captureException(new Error('First error'));
          }}
        />

        <SectionPressItem
          title="Sentry Native Crash"
          onPress={() => {
            nativeCrash();
          }}
        />
      </>
    );
  }

  return (
    <SectionPressItem
      title="Sentry Crash Test"
      onPress={() => {
        a();
      }}
    />
  );
}
