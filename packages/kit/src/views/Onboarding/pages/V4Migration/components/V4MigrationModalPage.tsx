import { useEffect, useRef } from 'react';

import { useIsFocused } from '@react-navigation/native';

import { Page } from '@onekeyhq/components';

import {
  EModalExitPreventMode,
  useV4MigrationExitPrevent,
} from '../hooks/useV4MigrationExitPrevent';

export function V4MigrationModalPage({
  children,
  onMounted,
  exitPreventMode = EModalExitPreventMode.confirm,
  isAutoStartOnMount,
}: {
  children: React.ReactNode;
  onMounted?: () => void;
  exitPreventMode?: EModalExitPreventMode;
  isAutoStartOnMount?: boolean;
}) {
  const timer = useRef<any>(null);
  const isFocused = useIsFocused();

  useV4MigrationExitPrevent({ exitPreventMode, isAutoStartOnMount });

  useEffect(() => {
    if (isFocused) {
      console.log('V4MigrationModalPage   focused');
      clearTimeout(timer.current);
    }
  }, [isFocused]);
  return (
    <Page
      scrollEnabled
      onMounted={() => {
        console.log('V4MigrationModalPage   mounted');
        onMounted?.();
      }}
      onUnmounted={() => {
        console.log('V4MigrationModalPage   unmounted');
      }}
      onClose={() => {
        console.log('V4MigrationModalPage   onClose');
      }}
    >
      {children}
    </Page>
  );
}
