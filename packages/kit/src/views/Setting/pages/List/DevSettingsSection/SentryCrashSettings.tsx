import { useState } from 'react';

import {
  captureException,
  nativeCrash,
} from '@onekeyhq/shared/src/modules3rdParty/sentry';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { SectionPressItem } from './SectionPressItem';

export function SentryCrashSettings() {
  const [state, setState] = useState({ text: 'Error Boundary' });
  const sections = [
    <SectionPressItem
      key="SentryCrashTest"
      title="Sentry Crash Test"
      onPress={() => {
        captureException(new Error('First error'));
      }}
    />,
    <SectionPressItem
      key="SentryCrashTest"
      title={`Sentry Crash Test With  ${state.text}`}
      onPress={() => {
        setState(null as any);
      }}
    />,
  ];
  if (platformEnv.isNative) {
    sections.push(
      <SectionPressItem
        title="Sentry Native Crash"
        onPress={() => {
          nativeCrash();
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
