/** @jest-environment jsdom */
import type { ReactNode } from 'react';

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { HardwareCloudSyncKeySection } from './HardwareCloudSyncKeySection';

const mockToggle = jest.fn<
  Promise<{ requiresHardware: boolean } | undefined>,
  [unknown]
>();
const mockEnable = jest.fn(async () => undefined);
const mockCancel = jest.fn(async () => true);
let mockConfig = {
  isCloudSyncEnabled: false,
  isCloudSyncEnabledKeyless: false,
  hardwareCloudSyncKeySource: { credentialId: 'hardware-root-A' },
};

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isDev: true },
}));
jest.mock('@onekeyhq/components', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  type IProps = {
    children?: ReactNode;
    testID?: string;
    disabled?: boolean;
    onPress?: () => Promise<void>;
    title?: string;
    description?: string;
  };
  return {
    Stack: ({ children }: IProps) => createElement('div', {}, children),
    SizableText: ({ children }: IProps) => createElement('span', {}, children),
    Alert: ({ title, description }: IProps) =>
      createElement('div', {}, title, description),
    Button: ({ children, testID, disabled, onPress }: IProps) =>
      createElement(
        'button',
        { 'data-testid': testID, disabled, onClick: onPress },
        children,
      ),
  };
});
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceKeylessCloudSync: {
      toggleCloudSyncKeyless: (params: unknown) => mockToggle(params),
      enableHardwareCloudSync: () => mockEnable(),
      cancelHardwareCloudKeyOperation: () => mockCancel(),
      getHardwareCloudSyncCandidates: async () => [],
    },
  },
}));
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: () => ({ result: [{ id: 'hw-A', name: 'Device A' }] }),
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/prime', () => ({
  usePrimeCloudSyncPersistAtom: () => [mockConfig],
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockConfig = {
    isCloudSyncEnabled: false,
    isCloudSyncEnabledKeyless: false,
    hardwareCloudSyncKeySource: { credentialId: 'hardware-root-A' },
  };
  mockToggle.mockResolvedValue({ requiresHardware: false });
});
afterEach(() => jest.restoreAllMocks());

test('turn off then resume uses saved-source toggle instead of hardware derivation', async () => {
  mockConfig.isCloudSyncEnabledKeyless = true;
  mockToggle.mockImplementation(async () => {
    mockConfig.isCloudSyncEnabledKeyless = false;
    return undefined;
  });
  const { rerender } = render(<HardwareCloudSyncKeySection />);
  fireEvent.click(screen.getByTestId('cloud-hardware-key-disable'));
  await waitFor(() =>
    expect(mockToggle).toHaveBeenCalledWith({ enabled: false }),
  );
  rerender(<HardwareCloudSyncKeySection />);
  mockToggle.mockResolvedValue({ requiresHardware: false });
  fireEvent.click(screen.getByTestId('cloud-hardware-key-resume'));
  await waitFor(() =>
    expect(mockToggle).toHaveBeenCalledWith({
      enabled: true,
      expectedHardwareCloudKeySourceId: 'hardware-root-A',
    }),
  );
  expect(mockEnable).not.toHaveBeenCalled();
});

test('missing credential shows an explicit hardware recovery hint', async () => {
  mockToggle.mockResolvedValue({ requiresHardware: true });
  render(<HardwareCloudSyncKeySection />);
  fireEvent.click(screen.getByTestId('cloud-hardware-key-resume'));
  await screen.findByText(/Connect your standard hardware wallet/);
  expect(mockEnable).not.toHaveBeenCalled();
});

test('late missing-key result does not show recovery for another selected source', async () => {
  let resolve: (value: { requiresHardware: boolean }) => void = () => undefined;
  mockToggle.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const { rerender } = render(<HardwareCloudSyncKeySection />);
  fireEvent.click(screen.getByTestId('cloud-hardware-key-resume'));
  mockConfig = {
    ...mockConfig,
    hardwareCloudSyncKeySource: { credentialId: 'hardware-root-B' },
  };
  rerender(<HardwareCloudSyncKeySection />);
  await act(async () => resolve({ requiresHardware: true }));
  expect(
    screen.queryByText(/Connect your standard hardware wallet/),
  ).toBeNull();
});

test('pending resume exposes cancellation and production keeps resume unavailable', async () => {
  let resolve: (value: { requiresHardware: boolean }) => void = () => undefined;
  mockToggle.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const { rerender } = render(<HardwareCloudSyncKeySection />);
  fireEvent.click(screen.getByTestId('cloud-hardware-key-resume'));
  fireEvent.click(screen.getByTestId('cloud-hardware-key-cancel'));
  expect(mockCancel).toHaveBeenCalled();
  await act(async () => resolve({ requiresHardware: false }));
  jest.replaceProperty(platformEnv, 'isDev', false);
  rerender(<HardwareCloudSyncKeySection />);
  expect(screen.queryByTestId('cloud-hardware-key-resume')).toBeNull();
  expect(screen.queryByTestId('cloud-hardware-key-enable-hw-A')).toBeNull();
});
