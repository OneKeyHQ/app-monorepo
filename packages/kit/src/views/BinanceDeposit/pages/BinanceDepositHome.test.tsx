/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { render, screen } from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { BinanceDepositTestIDs } from '../testIDs';

import BinanceDepositHome from './BinanceDepositHome';

// What the persisted developer settings atom holds. Developer mode is the
// `enabled` flag; it can be on in a production bundle.
const mockDevSettings: {
  enabled: boolean;
  settings?: Record<string, boolean>;
} = { enabled: true, settings: {} };

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings', () => ({
  useDevSettingsPersistAtom: () => [mockDevSettings],
}));

jest.mock('@onekeyhq/components', () => {
  const Passthrough = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  const Page = Object.assign(Passthrough, {
    Header: ({ title }: { title: string }) => <h1>{title}</h1>,
    Body: Passthrough,
    Container: Passthrough,
  });
  return {
    Page,
    Alert: ({
      title,
      description,
      testID,
    }: {
      title?: string;
      description?: string;
      testID?: string;
    }) => (
      <div data-testid={testID}>
        <span>{title}</span>
        <span>{description}</span>
      </div>
    ),
    Badge: Passthrough,
    Button: Passthrough,
    Input: () => null,
    Select: () => null,
    Stack: Passthrough,
    XStack: Passthrough,
    useClipboard: jest.fn(),
  };
});

// Stands for the whole page content: the provider is the only thing the gate
// lets through, and everything that talks to the service is mounted below it.
const mockContentMounted = jest.fn();
jest.mock('../../../components/AccountSelector', () => ({
  AccountSelectorProviderMirror: (props: {
    config: { sceneName: string };
    enabledNum: number[];
  }) => {
    mockContentMounted({
      config: props.config,
      enabledNum: props.enabledNum,
    });
    return <div data-testid="mock-deposit-content" />;
  },
}));

// The hooks of the page content. None of them may run behind the gate.
const mockContentHook = jest.fn();
jest.mock('../../../states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: (...args: unknown[]): unknown => mockContentHook(...args),
}));
jest.mock('../hooks/useBinanceDepositActions', () => ({
  useBinanceDepositActions: (...args: unknown[]): unknown =>
    mockContentHook(...args),
}));
jest.mock('../hooks/useBinanceDepositAssets', () => ({
  useBinanceDepositAssets: (...args: unknown[]): unknown =>
    mockContentHook(...args),
}));
jest.mock('../hooks/useBinanceDepositPageLog', () => ({
  useBinanceDepositPageLog: (...args: unknown[]): unknown =>
    mockContentHook(...args),
}));
jest.mock('../hooks/useBinanceDepositSend', () => ({
  useBinanceDepositSend: (...args: unknown[]): unknown =>
    mockContentHook(...args),
}));
jest.mock('../hooks/useBinanceDepositSender', () => ({
  useBinanceDepositSender: (...args: unknown[]): unknown =>
    mockContentHook(...args),
}));
jest.mock('../hooks/useBinanceDepositState', () => ({
  useBinanceDepositState: (...args: unknown[]): unknown =>
    mockContentHook(...args),
}));
jest.mock('../sendFlow', () => ({
  BINANCE_DEPOSIT_SIGN_ONLY_TEXT: 'sign only',
}));
jest.mock('../components/BinanceDepositLayout', () => ({
  DepositField: () => null,
  DepositHint: () => null,
  DepositSection: () => null,
}));
jest.mock('../components/BinanceDepositSessionSections', () => ({
  DestinationSection: () => null,
  EventsSection: () => null,
  RecentSessionsSection: () => null,
  ReportSection: () => null,
  SessionSection: () => null,
}));

describe('BinanceDepositHome', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDevSettings.enabled = true;
    mockDevSettings.settings = {};
    jest.replaceProperty(platformEnv, 'isNative', true);
    // As in a production bundle, where the self-test still has to work.
    jest.replaceProperty(platformEnv, 'isDev', false);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('mounts the page content on native while developer mode is on', () => {
    render(<BinanceDepositHome />);

    expect(screen.getByTestId('mock-deposit-content')).toBeTruthy();
    expect(mockContentMounted).toHaveBeenCalledWith({
      config: { sceneName: EAccountSelectorSceneName.home },
      enabledNum: [0],
    });
    expect(
      screen.queryByTestId(BinanceDepositTestIDs.unavailableAlert),
    ).toBeNull();
  });

  it('shows "Not available" and mounts nothing while developer mode is off', () => {
    mockDevSettings.enabled = false;
    // A switch left behind in the stored settings does not count.
    mockDevSettings.settings = { enableTestEndpoint: true };

    render(<BinanceDepositHome />);

    const alert = screen.getByTestId(BinanceDepositTestIDs.unavailableAlert);
    expect(alert.textContent).toContain('Not available');
    expect(alert.textContent).toContain('developer mode');
    expect(screen.queryByTestId('mock-deposit-content')).toBeNull();
    expect(mockContentMounted).not.toHaveBeenCalled();
    expect(mockContentHook).not.toHaveBeenCalled();
  });

  it('does not open up for a development build while developer mode is off', () => {
    mockDevSettings.enabled = false;
    jest.replaceProperty(platformEnv, 'isDev', true);

    render(<BinanceDepositHome />);

    expect(
      screen.getByTestId(BinanceDepositTestIDs.unavailableAlert),
    ).toBeTruthy();
    expect(mockContentMounted).not.toHaveBeenCalled();
    expect(mockContentHook).not.toHaveBeenCalled();
  });

  it('shows "Not available" and mounts nothing outside the native apps', () => {
    jest.replaceProperty(platformEnv, 'isNative', false);

    render(<BinanceDepositHome />);

    const alert = screen.getByTestId(BinanceDepositTestIDs.unavailableAlert);
    expect(alert.textContent).toContain('Not available on this platform');
    expect(screen.queryByTestId('mock-deposit-content')).toBeNull();
    expect(mockContentMounted).not.toHaveBeenCalled();
    expect(mockContentHook).not.toHaveBeenCalled();
  });

  it('unmounts the content as soon as developer mode is switched off', () => {
    const { rerender } = render(<BinanceDepositHome />);
    expect(screen.getByTestId('mock-deposit-content')).toBeTruthy();

    mockDevSettings.enabled = false;
    rerender(<BinanceDepositHome />);

    expect(screen.queryByTestId('mock-deposit-content')).toBeNull();
    expect(
      screen.getByTestId(BinanceDepositTestIDs.unavailableAlert),
    ).toBeTruthy();
  });
});
