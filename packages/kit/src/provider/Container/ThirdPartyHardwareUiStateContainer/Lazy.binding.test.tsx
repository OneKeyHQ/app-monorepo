/** @jest-environment jsdom */
import { useSyncExternalStore } from 'react';

import { act, render } from '@testing-library/react';

import type { IThirdPartyBleBindingState } from '@onekeyhq/kit-bg/src/states/jotai/atoms/hardware';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import { ThirdPartyHardwareUiStateContainerLazy } from './Lazy';
import { ThirdPartyHardwareUiStateAtomWatcher } from './ThirdPartyHardwareUiStateAtomWatcher';

let mockBinding: IThirdPartyBleBindingState | undefined;
const mockLoadContainer = jest.fn();
const mockBindingListeners = new Set<() => void>();
const mockSubscribe = (listener: () => void) => {
  mockBindingListeners.add(listener);
  return () => {
    mockBindingListeners.delete(listener);
  };
};
function setBinding(value: IThirdPartyBleBindingState) {
  act(() => {
    mockBinding = value;
    mockBindingListeners.forEach((listener) => listener());
  });
}
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/hardware', () => ({
  useThirdPartyHardwareUiStateAtom: () => [undefined],
  useThirdPartyAppInstallAtom: () => [undefined],
  useThirdPartyBatchInstallAtom: () => [undefined],
  useThirdPartyBleBindingAtom: () => [
    useSyncExternalStore(mockSubscribe, () => mockBinding),
  ],
}));
jest.mock('./index', () => {
  mockLoadContainer();
  return { ThirdPartyHardwareUiStateContainer: () => null };
});

function binding(
  status: IThirdPartyBleBindingState['status'],
): IThirdPartyBleBindingState {
  return {
    vendor: EHardwareVendor.ledger,
    bindingSessionId: 'binding-1',
    requestId: 'request-1',
    status,
    targets: [],
  };
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  mockBinding = undefined;
  jest.clearAllMocks();
});

it('keeps the full container lazy until a standalone BLE binding needs it', async () => {
  const view = render(<ThirdPartyHardwareUiStateContainerLazy />);
  await flush();
  expect(mockLoadContainer).not.toHaveBeenCalled();
  setBinding(binding('scanning'));
  view.rerender(<ThirdPartyHardwareUiStateContainerLazy />);
  await flush();
  expect(mockLoadContainer).toHaveBeenCalledTimes(1);
  setBinding({ ...binding('scanning'), targets: [] });
  view.rerender(<ThirdPartyHardwareUiStateContainerLazy />);
  await flush();
  expect(mockLoadContainer).toHaveBeenCalledTimes(1);
});

it('does not repeat loading notifications for refreshed scan results or verification', () => {
  mockBinding = binding('scanning');
  const onShouldMount = jest.fn();
  const view = render(
    <ThirdPartyHardwareUiStateAtomWatcher onShouldMount={onShouldMount} />,
  );
  expect(onShouldMount).toHaveBeenCalledTimes(1);
  setBinding({ ...binding('scanning'), targets: [] });
  view.rerender(
    <ThirdPartyHardwareUiStateAtomWatcher onShouldMount={onShouldMount} />,
  );
  setBinding(binding('verifying'));
  view.rerender(
    <ThirdPartyHardwareUiStateAtomWatcher onShouldMount={onShouldMount} />,
  );
  expect(onShouldMount).toHaveBeenCalledTimes(1);
});

it.each(['saved', 'failed', 'cancelled'] as const)(
  'does not load for an already %s binding',
  (status) => {
    mockBinding = binding(status);
    const onShouldMount = jest.fn();
    render(
      <ThirdPartyHardwareUiStateAtomWatcher onShouldMount={onShouldMount} />,
    );
    expect(onShouldMount).not.toHaveBeenCalled();
  },
);
