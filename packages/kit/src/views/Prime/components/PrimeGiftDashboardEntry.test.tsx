/** @jest-environment jsdom */

import type { ReactNode, Ref } from 'react';

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { IntlProvider } from 'react-intl';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import enMessages from '@onekeyhq/shared/src/locale/json/en_US.json';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EPrimeGiftPages } from '@onekeyhq/shared/src/routes/prime';

import { PrimeGiftDashboardEntry } from './PrimeGiftDashboardEntry';

import type { IPrimeGiftClaimableDevice } from '../hooks/primeGiftClaimableDevices';

const messages: Record<string, string> = enMessages;

const mockPushModal = jest.fn();
const mockOfferClick = jest.fn();
const mockDialogClose = jest.fn<Promise<void>, []>(async () => undefined);
const mockDialogShow = jest.fn<
  void,
  [{ title: string; renderContent: ReactNode; onClose?: () => void }]
>();
let mockDevices: IPrimeGiftClaimableDevice[] | undefined = [];

jest.mock('../hooks/usePrimeGiftOfferImpression', () => ({
  usePrimeGiftOfferImpression: () => jest.fn(),
}));
jest.mock('../hooks/primeGiftDuration', () => ({
  getPrimeGiftDurationText: (value: { giftMonths?: number }) =>
    typeof value.giftMonths === 'number' && value.giftMonths > 0
      ? `${value.giftMonths} months`
      : '',
}));
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ pushModal: mockPushModal }),
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    prime: {
      subscription: {
        primeGiftOfferClick: (...args: unknown[]) => {
          mockOfferClick(...args);
        },
      },
    },
  },
}));
jest.mock('@onekeyhq/kit/src/components/ListItem', () => ({
  ListItem: ({
    testID,
    title,
    onPress,
  }: {
    testID: string;
    title: string;
    onPress: () => void;
  }) => (
    <button type="button" data-testid={testID} onClick={onPress}>
      {title}
    </button>
  ),
}));
jest.mock('@onekeyhq/kit/src/components/WalletAvatar', () => ({
  WalletAvatar: () => null,
}));
jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual('react') as typeof import('react');
  const Frame = React.forwardRef(function Frame(
    {
      children,
      onPress,
      testID,
    }: {
      children?: ReactNode;
      onPress?: () => void;
      testID?: string;
    },
    ref: Ref<HTMLElement>,
  ) {
    return React.createElement(
      onPress ? 'button' : 'div',
      {
        'data-testid': testID,
        onClick: onPress,
        ref,
        type: onPress ? 'button' : undefined,
      },
      children,
    );
  });
  return {
    Dialog: {
      ScrollView: Frame,
      show: (options: {
        title: string;
        renderContent: ReactNode;
        onClose?: () => void;
      }) => {
        mockDialogShow(options);
      },
    },
    useDialogInstance: () => ({ close: mockDialogClose }),
    Icon: () => null,
    Image: () => null,
    SizableText: ({ children }: { children?: ReactNode }) =>
      React.createElement('span', null, children),
    XStack: Frame,
    YStack: Frame,
  };
});

function device(
  serialNo: string,
  giftMonths: number,
): IPrimeGiftClaimableDevice {
  return {
    serialNo,
    createdAt: 1,
    device: {
      name: 'OneKey Pro 2',
      uuid: serialNo,
      connectId: serialNo,
      deviceId: serialNo,
      deviceType: 'pro2',
    },
    wallet: { id: serialNo, name: serialNo },
    eligibility: {
      sno: serialNo,
      eligible: true,
      hasUnclaimedGift: true,
      giftDays: 180,
      giftMonths,
    },
  } as IPrimeGiftClaimableDevice;
}

function renderEntry(isPrimeActive = false) {
  return render(
    <IntlProvider locale="en" messages={messages}>
      <PrimeGiftDashboardEntry
        devices={mockDevices}
        isPrimeActive={isPrimeActive}
      />
    </IntlProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockDevices = [];
});

it('renders nothing until a Pro 2 still has Prime to claim', () => {
  mockDevices = undefined;
  const hidden = renderEntry();
  expect(screen.queryByTestId('prime-gift-dashboard-entry')).toBeNull();
  hidden.unmount();

  mockDevices = [];
  renderEntry();
  expect(screen.queryByTestId('prime-gift-dashboard-entry')).toBeNull();
});

it('opens the existing claim modal for one device and selects a device in a dialog for several', async () => {
  mockDevices = [device('SN1', 6)];
  const view = renderEntry();
  expect(screen.getByText('Claim 6 months of Prime')).toBeTruthy();
  expect(screen.queryByText('Learn more')).toBeNull();
  fireEvent.click(screen.getByTestId('prime-gift-dashboard-entry'));
  expect(mockOfferClick).toHaveBeenCalledWith({
    source: 'primeDashboard',
    deviceCount: 1,
  });
  expect(mockPushModal).toHaveBeenCalledWith(EModalRoutes.PrimeGiftModal, {
    screen: EPrimeGiftPages.PrimeGift,
    params: {
      serialNo: 'SN1',
      source: 'primeDashboard',
      device: expect.objectContaining({ uuid: 'SN1', deviceType: 'pro2' }),
    },
  });

  mockDevices = [device('SN1', 6), device('SN2', 12)];
  view.rerender(
    <IntlProvider locale="en" messages={messages}>
      <PrimeGiftDashboardEntry devices={mockDevices} />
    </IntlProvider>,
  );
  expect(
    screen.getByText('Claim the Prime included with your device.'),
  ).toBeTruthy();
  fireEvent.click(screen.getByTestId('prime-gift-dashboard-entry'));
  fireEvent.click(screen.getByTestId('prime-gift-dashboard-entry'));
  expect(mockOfferClick).toHaveBeenLastCalledWith({
    source: 'primeDashboard',
    deviceCount: 2,
  });
  expect(mockPushModal).toHaveBeenCalledTimes(1);
  expect(mockDialogShow).toHaveBeenCalledTimes(1);
  const dialog = mockDialogShow.mock.calls[0][0];
  expect(dialog.title).toBe('Choose a Pro 2');
  render(
    <IntlProvider locale="en" messages={messages}>
      <>{dialog.renderContent}</>
    </IntlProvider>,
  );
  let finishClose: () => void = () => undefined;
  mockDialogClose.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finishClose = resolve;
      }),
  );
  fireEvent.click(screen.getByTestId('prime-gift-select-SN2'));
  fireEvent.click(screen.getByTestId('prime-gift-select-SN2'));
  expect(mockDialogClose).toHaveBeenCalledTimes(1);
  expect(mockPushModal).toHaveBeenCalledTimes(1);
  await act(async () => finishClose());
  await waitFor(() => expect(mockPushModal).toHaveBeenCalledTimes(2));
  expect(mockPushModal).toHaveBeenLastCalledWith(EModalRoutes.PrimeGiftModal, {
    screen: EPrimeGiftPages.PrimeGift,
    params: {
      serialNo: 'SN2',
      source: 'primeDashboard',
      device: expect.objectContaining({ uuid: 'SN2' }),
    },
  });
});

it('allows another device selection after the picker fails to close', async () => {
  mockDevices = [device('SN1', 6), device('SN2', 6)];
  renderEntry();
  fireEvent.click(screen.getByTestId('prime-gift-dashboard-entry'));
  const dialog = mockDialogShow.mock.calls[0][0];
  render(
    <IntlProvider locale="en" messages={messages}>
      <>{dialog.renderContent}</>
    </IntlProvider>,
  );
  mockDialogClose.mockRejectedValueOnce(new OneKeyLocalError('dismiss failed'));
  await act(async () => {
    fireEvent.click(screen.getByTestId('prime-gift-select-SN1'));
  });
  expect(mockDialogClose).toHaveBeenCalledTimes(1);
  expect(mockPushModal).not.toHaveBeenCalled();

  fireEvent.click(screen.getByTestId('prime-gift-select-SN2'));
  await waitFor(() => expect(mockPushModal).toHaveBeenCalledTimes(1));
  expect(mockDialogClose).toHaveBeenCalledTimes(2);
  expect(mockPushModal).toHaveBeenCalledWith(EModalRoutes.PrimeGiftModal, {
    screen: EPrimeGiftPages.PrimeGift,
    params: {
      serialNo: 'SN2',
      source: 'primeDashboard',
      device: expect.objectContaining({ uuid: 'SN2' }),
    },
  });
});

it('can reopen the device picker after it has closed', () => {
  mockDevices = [device('SN1', 6), device('SN2', 6)];
  renderEntry();
  fireEvent.click(screen.getByTestId('prime-gift-dashboard-entry'));
  const dialog = mockDialogShow.mock.calls[0][0];
  expect(dialog.onClose).toBeDefined();
  act(() => dialog.onClose?.());
  fireEvent.click(screen.getByTestId('prime-gift-dashboard-entry'));
  expect(mockDialogShow).toHaveBeenCalledTimes(2);
  expect(mockPushModal).not.toHaveBeenCalled();
});

it('shows the paid-subscription condition for current Prime members without blocking the gift flow', () => {
  mockDevices = [device('SN1', 6)];
  renderEntry(true);
  expect(
    screen.getByText('You can still claim if you’re not on a paid Prime plan.'),
  ).toBeTruthy();
  expect(screen.queryByText('Claim 6 months of Prime')).toBeNull();
  fireEvent.click(screen.getByTestId('prime-gift-dashboard-entry'));
  expect(mockPushModal).toHaveBeenCalledWith(EModalRoutes.PrimeGiftModal, {
    screen: EPrimeGiftPages.PrimeGift,
    params: {
      serialNo: 'SN1',
      source: 'primeDashboard',
      device: expect.objectContaining({ uuid: 'SN1' }),
    },
  });
});
