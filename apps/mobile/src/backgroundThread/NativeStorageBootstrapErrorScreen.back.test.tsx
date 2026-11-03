/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

import { NativeStorageBootstrapErrorScreen } from './NativeStorageBootstrapErrorScreen';

import type { INativeStorageBootstrapErrorScreenProps } from './NativeStorageBootstrapErrorScreen';

type IProps = {
  children?: ReactNode;
  testID?: string;
  disabled?: boolean;
  onPress?: () => void;
};
function View({ children, testID }: IProps) {
  return <div data-testid={testID}>{children}</div>;
}
jest.mock('react-native', () => ({
  ScrollView: View,
  Text: View,
  ActivityIndicator: View,
  StyleSheet: { create: (styles: unknown) => styles },
  Pressable: ({ children, testID, disabled, onPress }: IProps) => (
    <button
      type="button"
      data-testid={testID}
      disabled={disabled}
      onClick={onPress}
    >
      {children}
    </button>
  ),
}));

function buildProps(
  extra: Partial<INativeStorageBootstrapErrorScreenProps> = {},
): INativeStorageBootstrapErrorScreenProps {
  return {
    bootstrapErrorTitle: 'Storage failed',
    recoveryTarget: 'appStorage',
    hasAppComponent: true,
    storageRepairInProgress: false,
    storageRepairCompleted: false,
    storageRepairCanReset: false,
    startStorageRepair: jest.fn(async () => undefined),
    retryBootstrapAfterFailure: jest.fn(async () => undefined),
    restartAfterBootstrapFailure: jest.fn(async () => undefined),
    releaseStorageRecoveryTestFault: jest.fn(async () => undefined),
    onBack: jest.fn(),
    backRequestRef: { current: null },
    ...extra,
  };
}

it.each(['appStorage', 'jotai'] as const)(
  'returns from %s without calling recovery or restart services',
  (recoveryTarget) => {
    const props = buildProps({ recoveryTarget });
    render(<NativeStorageBootstrapErrorScreen {...props} />);
    fireEvent.click(screen.getByTestId('native-storage-repair-back'));
    expect(props.onBack).toHaveBeenCalledTimes(1);
    expect(props.startStorageRepair).not.toHaveBeenCalled();
    expect(props.restartAfterBootstrapFailure).not.toHaveBeenCalled();
    expect(props.retryBootstrapAfterFailure).not.toHaveBeenCalled();
  },
);

it('cancels emergency confirmation on system back, then leaves on the next back without activating it', () => {
  const backRequestRef = { current: null as (() => void) | null };
  const props = buildProps({
    storageRepairError: 'Repair failed',
    backRequestRef,
  });
  render(<NativeStorageBootstrapErrorScreen {...props} />);
  fireEvent.click(screen.getByTestId('native-storage-emergency-open'));
  expect(screen.getByTestId('native-storage-emergency-confirm')).toBeTruthy();
  act(() => backRequestRef.current?.());
  expect(screen.queryByTestId('native-storage-emergency-confirm')).toBeNull();
  expect(props.onBack).not.toHaveBeenCalled();
  act(() => backRequestRef.current?.());
  expect(props.onBack).toHaveBeenCalledTimes(1);
  expect(props.startStorageRepair).not.toHaveBeenCalled();
});

it.each(['jotai', 'appStorage'] as const)(
  'cancels the %s destructive confirmation before leaving',
  (recoveryTarget) => {
    const backRequestRef = { current: null as (() => void) | null };
    const props = buildProps({
      recoveryTarget,
      testSessionId:
        recoveryTarget === 'appStorage' ? 'isolated-confirmation' : undefined,
      storageRepairCanReset: true,
      backRequestRef,
      storageRepairSummary:
        recoveryTarget === 'appStorage'
          ? {
              repairId: 'incomplete',
              successfulCount: 1,
              failedCount: 1,
              preservedCount: 1,
              recoveredCount: 0,
              scanComplete: false,
            }
          : undefined,
    });
    render(<NativeStorageBootstrapErrorScreen {...props} />);
    fireEvent.click(
      screen.getByTestId(
        recoveryTarget === 'appStorage'
          ? 'native-storage-repair-complete'
          : 'native-storage-migration-repair',
      ),
    );
    act(() => backRequestRef.current?.());
    expect(
      screen.queryByTestId('native-storage-migration-repair-confirm'),
    ).toBeNull();
    expect(props.onBack).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('native-storage-repair-back'));
    expect(props.onBack).toHaveBeenCalledTimes(1);
    expect(props.startStorageRepair).not.toHaveBeenCalled();
  },
);

it.each(['running', 'completed', 'emergency', 'no previous app'])(
  'blocks back while %s, including the system gesture callback',
  (state) => {
    const backRequestRef = { current: null as (() => void) | null };
    const props = buildProps({
      backRequestRef,
      storageRepairInProgress: state === 'running',
      storageRepairCompleted: state === 'completed',
      storageEmergencyModeEnabled: state === 'emergency',
      hasAppComponent: state !== 'no previous app',
    });
    render(<NativeStorageBootstrapErrorScreen {...props} />);
    act(() => backRequestRef.current?.());
    const button = screen.queryByTestId(
      'native-storage-repair-back',
    ) as HTMLButtonElement | null;
    if (state === 'running') expect(button?.disabled).toBe(true);
    else expect(button).toBeNull();
    expect(props.onBack).not.toHaveBeenCalled();
    expect(props.startStorageRepair).not.toHaveBeenCalled();
  },
);

it('permits returning after an incomplete or failed operation has settled', () => {
  const backRequestRef = { current: null as (() => void) | null };
  const props = buildProps({ storageRepairInProgress: true, backRequestRef });
  const view = render(<NativeStorageBootstrapErrorScreen {...props} />);
  act(() => backRequestRef.current?.());
  expect(props.onBack).not.toHaveBeenCalled();
  view.rerender(
    <NativeStorageBootstrapErrorScreen
      {...props}
      storageRepairInProgress={false}
      storageRepairError="Repair failed"
    />,
  );
  act(() => backRequestRef.current?.());
  expect(props.onBack).toHaveBeenCalledTimes(1);
  view.unmount();
  expect(backRequestRef.current).toBeNull();
});
