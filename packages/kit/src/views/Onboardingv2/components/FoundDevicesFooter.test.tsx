/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { EDeviceType } from '@onekeyfe/hd-shared';
import { act, fireEvent, render, screen } from '@testing-library/react';

import type { IConnectYourDeviceItem } from '@onekeyhq/shared/types/device';

import { OnboardingTestIDs } from '../testIDs';

import { FoundDevicesFooter } from './FoundDevicesFooter';

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Container = ({ children }: { children?: ReactNode }) =>
    React.createElement('div', null, children);
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
jest.mock('../../../components/WalletAvatar', () => ({
  WalletAvatar: () => null,
}));

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
