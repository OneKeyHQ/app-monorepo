import { captureException } from '@onekeyhq/shared/src/modules3rdParty/sentry';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { SectionPressItem } from './SectionPressItem';

function a() {
  throw new Error('Function not implemented.');
}

export function SentryCrashSettings() {
  const sections = [
    <SectionPressItem
      key="SentryCrashTest"
      title="Sentry Crash Test"
      onPress={() => {
        captureException(new Error('First error'));
      }}
    />,
  ];
  if (platformEnv.isNative) {
    sections.push(
      <SectionPressItem
        title="Sentry Native Crash"
        onPress={() => {
          const nativeSentry =
            require('@onekeyhq/shared/src/modules3rdParty/sentry') as typeof import('@sentry/react-native');
          nativeSentry.nativeCrash();
        }}
      />,
    );
  } else if (platformEnv.isDesktop) {
    sections.push(
      <SectionPressItem
        title="Sentry Native Crash"
        onPress={() => {
          globalThis.desktopApi.testCrash();
        }}
      />,
    );
  }

  return sections;
}
