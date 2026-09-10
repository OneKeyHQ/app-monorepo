import { useState } from 'react';

import {
  captureException,
  nativeCrash,
} from '@onekeyhq/shared/src/modules3rdParty/sentry';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { exportLogs } from '../exportLogs';

import { SectionPressItem } from './SectionPressItem';

export function SentryCrashSettings() {
  const [state, setState] = useState({ text: 'Error Boundary' });
  const sections = [
    <SectionPressItem
      icon="SendOutline"
      key="SentryCrashTest1"
      title="Sentry Crash Test"
      onPress={() => {
        captureException(new Error('First error'));
      }}
    />,
    <SectionPressItem
      icon="SendOutline"
      key="SentryCrashTest2"
      title={`Sentry Crash Test With  ${state.text}`}
      onPress={() => {
        setState(null as any);
      }}
    />,
  ];
  if (platformEnv.isNative) {
    sections.push(
      <SectionPressItem
        icon="DownloadOutline"
        key="SentryCrashDiagnosticsExport"
        testID="sentry-native-crash-export"
        title="Export Logs With Native Crash Diagnostics"
        onPress={() => {
          void exportLogs(`OneKeyNativeCrashDiagnostics-${Date.now()}`);
        }}
      />,
      <SectionPressItem
        icon="SendOutline"
        key="SentryCrashTest3"
        testID="sentry-native-crash"
        title="Sentry Native Crash"
        onPress={() => {
          nativeCrash();
        }}
      />,
    );
  } else if (platformEnv.isDesktop) {
    sections.push(
      <SectionPressItem
        icon="SendOutline"
        key="SentryCrashTest4"
        title="Sentry Native Crash"
        onPress={() => {
          globalThis.desktopApi.testCrash();
        }}
      />,
    );
  }

  return sections;
}
