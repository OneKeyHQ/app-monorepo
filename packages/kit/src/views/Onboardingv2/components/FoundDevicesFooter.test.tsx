/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { EDeviceType } from '@onekeyfe/hd-shared';
import { act, fireEvent, render, screen } from '@testing-library/react';

import type { IConnectYourDeviceItem } from '@onekeyhq/shared/types/device';

import { OnboardingTestIDs } from '../testIDs';

import { FoundDevicesFooter } from './FoundDevicesFooter';

const mockPreventClose = jest.fn();
let mockFooterConfirm:
  | ((dialog: { preventClose: () => void }) => Promise<void>)
  | undefined;

beforeEach(() => {
  mockPreventClose.mockClear();
  mockFooterConfirm = undefined;
});

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Container = ({
    children,
    testID,
  }: {
    children?: ReactNode;
    testID?: string;
  }) => React.createElement('div', { 'data-testid': testID }, children);
  return {
    Button: ({
      children,
      onPress,
      testID,
      disabled,
    }: {
      children?: ReactNode;
      onPress?: () => void;
      testID?: string;
      disabled?: boolean;
    }) =>
      React.createElement(
        'button',
        { onClick: onPress, 'data-testid': testID, disabled },
        children,
      ),
    HeightTransition: Container,
    SizableText: Container,
    Stack: Container,
    XStack: Container,
    YStack: Container,
    Icon: () => null,
    Spinner: () => null,
    Dialog: {
      Footer: ({
        showFooter,
        onConfirm,
        onConfirmText,
        confirmButtonProps,
      }: {
        showFooter?: boolean;
        onConfirm?: (dialog: { preventClose: () => void }) => Promise<void>;
        onConfirmText?: string;
        confirmButtonProps?: { testID?: string; disabled?: boolean };
      }) => {
        mockFooterConfirm = onConfirm;
        return showFooter
          ? React.createElement(
              'button',
              {
                'data-testid': confirmButtonProps?.testID,
                disabled: confirmButtonProps?.disabled,
                onClick: () => {
                  void onConfirm?.({ preventClose: mockPreventClose });
                },
              },
              onConfirmText,
            )
          : null;
      },
    },
    useMedia: () => ({ gtMd: true }),
  };
});
jest.mock('../../../components/ListItem', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    ListItem: Object.assign(
      ({
        children,
        onPress,
        testID,
      }: {
        children?: ReactNode;
        onPress?: () => void;
        testID?: string;
      }) =>
        React.createElement(
          'button',
          { onClick: onPress, 'data-testid': testID },
          children,
        ),
      { Text: ({ primary }: { primary?: string }) => primary },
    ),
  };
});
jest.mock('../../../components/WalletAvatar', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    WalletAvatar: ({ img }: { img?: string }) =>
      React.createElement('span', { 'data-testid': 'wallet-avatar' }, img),
  };
});

function device(connectId: string): IConnectYourDeviceItem {
  return {
    title: connectId,
    src: 0,
    device: {
      connectId,
      deviceId: null,
      uuid: connectId,
      name: connectId,
      deviceType: EDeviceType.Pro,
      commType: 'usb',
    },
  };
}

describe('FoundDevicesFooter device avatar', () => {
  it('wears the finish the scan row resolved, else the model default', () => {
    render(
      <FoundDevicesFooter
        devices={[
          { ...device('device-a'), avatarImg: 'pro2Orange' },
          device('device-b'),
        ]}
        isScanning
        onConnect={jest.fn()}
      />,
    );

    expect(
      screen.getAllByTestId('wallet-avatar').map((node) => node.textContent),
    ).toEqual(['pro2Orange', EDeviceType.Pro]);
  });
});

describe('FoundDevicesFooter connection actions', () => {
  const first = device('device-a');
  const second = device('device-b');
  const row = (key: string) =>
    screen.getByTestId(OnboardingTestIDs.connectYourDeviceItem(key));
  const connectButton = () =>
    screen.getByTestId(OnboardingTestIDs.connectYourDeviceConnectBtn);

  it('connects a single device when its name is clicked and ignores duplicate actions', async () => {
    let finish = () => {};
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const onConnect = jest.fn(() => pending);
    render(
      <FoundDevicesFooter devices={[first]} isScanning onConnect={onConnect} />,
    );

    fireEvent.click(screen.getByText('device-a'));
    fireEvent.click(row('device-a'));
    fireEvent.click(connectButton());
    expect(onConnect).toHaveBeenCalledTimes(1);
    expect(onConnect).toHaveBeenCalledWith(first);
    await act(async () => finish());

    await act(async () => fireEvent.click(connectButton()));
    expect(onConnect).toHaveBeenCalledTimes(2);
  });

  it('only selects a row when multiple devices are displayed', async () => {
    const onConnect = jest.fn();
    render(
      <FoundDevicesFooter
        devices={[first, second]}
        isScanning
        onConnect={onConnect}
      />,
    );

    fireEvent.click(row('device-b'));
    expect(onConnect).not.toHaveBeenCalled();
    await act(async () => fireEvent.click(connectButton()));
    expect(onConnect).toHaveBeenCalledWith(second);
  });

  it('connects the remaining device even if the previously selected device disappeared', async () => {
    const onConnect = jest.fn();
    const { rerender } = render(
      <FoundDevicesFooter
        devices={[first, second]}
        isScanning
        onConnect={onConnect}
      />,
    );
    fireEvent.click(row('device-b'));
    rerender(
      <FoundDevicesFooter devices={[first]} isScanning onConnect={onConnect} />,
    );

    await act(async () => fireEvent.click(row('device-a')));
    expect(onConnect).toHaveBeenCalledTimes(1);
    expect(onConnect).toHaveBeenCalledWith(first);
  });
});

describe('Cloud connection dialog', () => {
  it('keeps one search view through preparation and scanning', () => {
    const { rerender } = render(
      <FoundDevicesFooter
        variant="dialog"
        devices={[]}
        isPreparing
        isScanning={false}
        searchDescription="Keep the wallet nearby"
        onConnect={jest.fn()}
      />,
    );
    const search = screen.getByTestId('hardware-cloud-sync-device-search');
    expect(screen.getByText('Keep the wallet nearby')).toBeDefined();
    expect(
      screen.queryByTestId(OnboardingTestIDs.connectYourDeviceConnectBtn),
    ).toBeNull();
    rerender(
      <FoundDevicesFooter
        variant="dialog"
        devices={[]}
        isScanning
        searchDescription="Keep the wallet nearby"
        onConnect={jest.fn()}
      />,
    );
    expect(screen.getByTestId('hardware-cloud-sync-device-search')).toBe(
      search,
    );
  });

  it('does not claim to search before a required manual start', () => {
    render(
      <FoundDevicesFooter
        variant="dialog"
        devices={[]}
        isScanning={false}
        onConnect={jest.fn()}
      />,
    );
    expect(
      screen.queryByTestId('hardware-cloud-sync-device-search'),
    ).toBeNull();
    expect(
      screen.queryByText('onboarding.bluetooth_connect_help_text'),
    ).toBeNull();
  });

  it('keeps the chosen devices visible when a late scan round empties during connection', async () => {
    let finish = () => {};
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const onConnect = jest.fn(() => pending);
    const first = device('device-a');
    const second = device('device-b');
    const { rerender } = render(
      <FoundDevicesFooter
        variant="dialog"
        devices={[first, second]}
        isScanning
        onConnect={onConnect}
      />,
    );
    fireEvent.click(
      screen.getByTestId(OnboardingTestIDs.connectYourDeviceItem('device-b')),
    );
    fireEvent.click(
      screen.getByTestId(OnboardingTestIDs.connectYourDeviceConnectBtn),
    );
    rerender(
      <FoundDevicesFooter
        variant="dialog"
        devices={[]}
        isScanning
        onConnect={onConnect}
      />,
    );
    expect(screen.getByText('device-a')).toBeDefined();
    expect(screen.getByText('device-b')).toBeDefined();
    expect(
      screen.queryByTestId('hardware-cloud-sync-device-search'),
    ).toBeNull();
    fireEvent.click(
      screen.getByTestId(OnboardingTestIDs.connectYourDeviceConnectBtn),
    );
    expect(onConnect).toHaveBeenCalledTimes(1);
    expect(onConnect).toHaveBeenCalledWith(second);
    await act(async () => finish());
    expect(mockPreventClose).toHaveBeenCalled();
  });

  it('lets connection errors reach the standard footer and permits a retry', async () => {
    const failure = new Error('Connection failed');
    const onConnect = jest
      .fn<Promise<void>, [IConnectYourDeviceItem]>()
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce(undefined);
    render(
      <FoundDevicesFooter
        variant="dialog"
        devices={[device('device-a')]}
        isScanning
        onConnect={onConnect}
      />,
    );
    const confirm = mockFooterConfirm;
    expect(confirm).toBeDefined();
    await act(async () => {
      await expect(confirm?.({ preventClose: mockPreventClose })).rejects.toBe(
        failure,
      );
    });
    expect(mockPreventClose).not.toHaveBeenCalled();
    await act(async () => confirm?.({ preventClose: mockPreventClose }));
    expect(onConnect).toHaveBeenCalledTimes(2);
    expect(mockPreventClose).toHaveBeenCalledTimes(1);
  });
});
