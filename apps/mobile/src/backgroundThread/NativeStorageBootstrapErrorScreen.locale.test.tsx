/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

import {
  appLocale,
  fallbackAppLocaleIntl,
} from '@onekeyhq/shared/src/locale/appLocale';
import zhCN from '@onekeyhq/shared/src/locale/json/zh_CN.json';
import { loadLocaleMessages } from '@onekeyhq/shared/src/locale/localeLoaders';

import { NativeStorageBootstrapErrorScreen } from './NativeStorageBootstrapErrorScreen';

import type { INativeStorageBootstrapErrorScreenProps } from './NativeStorageBootstrapErrorScreen';

jest.mock('react-native', () => ({
  StyleSheet: { create: (styles: unknown) => styles },
  ActivityIndicator: () => <div />,
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  ScrollView: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Pressable: ({
    children,
    onPress,
    testID,
  }: {
    children?: ReactNode;
    onPress?: () => void;
    testID?: string;
  }) => (
    <button type="button" data-testid={testID} onClick={onPress}>
      {children}
    </button>
  ),
}));

const props: INativeStorageBootstrapErrorScreenProps = {
  bootstrapErrorTitle: 'Storage initialization failed',
  recoveryTarget: 'appStorage',
  storageRepairInProgress: false,
  storageRepairCompleted: false,
  storageRepairCanReset: false,
  storageRepairError: 'Storage unavailable',
  hasAppComponent: true,
  startStorageRepair: jest.fn(async () => undefined),
  retryBootstrapAfterFailure: jest.fn(async () => undefined),
  restartAfterBootstrapFailure: jest.fn(async () => undefined),
  releaseStorageRecoveryTestFault: jest.fn(async () => undefined),
  onBack: jest.fn(),
};

describe('recovery controls outside AppIntlProvider', () => {
  const originalIntl = appLocale.intl;
  afterEach(() =>
    appLocale.setLocale(originalIntl.locale, originalIntl.messages),
  );

  it('tracks the selected language without relying on healthy atoms or providers', async () => {
    const messages = await loadLocaleMessages('zh-CN');
    const view = render(<NativeStorageBootstrapErrorScreen {...props} />);
    expect(screen.getByTestId('native-storage-repair-back').textContent).toBe(
      'Back',
    );
    act(() => appLocale.setLocale('zh-CN', messages));
    expect(screen.getByTestId('native-storage-repair-back').textContent).toBe(
      zhCN['global.back'],
    );
    fireEvent.click(screen.getByTestId('native-storage-emergency-open'));
    expect(
      screen.getByTestId('native-storage-emergency-cancel').textContent,
    ).toBe(zhCN['global.cancel']);
    view.rerender(
      <NativeStorageBootstrapErrorScreen {...props} storageRepairCompleted />,
    );
    fireEvent.click(screen.getByTestId('native-storage-emergency-cancel'));
    expect(screen.getByTestId('native-storage-repair-close').textContent).toBe(
      zhCN['global.close'],
    );
    view.rerender(
      <NativeStorageBootstrapErrorScreen
        {...props}
        recoveryTarget={undefined}
      />,
    );
    expect(
      screen.getByTestId('native-storage-migration-retry').textContent,
    ).toBe(zhCN['global.retry']);
  });

  it('retains usable English controls before translations have loaded', () => {
    appLocale.setLocale('zh-CN', fallbackAppLocaleIntl.messages);
    render(<NativeStorageBootstrapErrorScreen {...props} />);
    expect(screen.getByTestId('native-storage-repair-back').textContent).toBe(
      'Back',
    );
    fireEvent.click(screen.getByTestId('native-storage-emergency-open'));
    expect(
      screen.getByTestId('native-storage-emergency-cancel').textContent,
    ).toBe('Cancel');
  });
});
