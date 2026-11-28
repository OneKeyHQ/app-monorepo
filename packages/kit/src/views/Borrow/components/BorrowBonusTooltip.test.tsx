/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IBorrowReserveItem } from '@onekeyhq/shared/types/staking';

import { BorrowBonusTooltip } from './BorrowBonusTooltip';

const mockClosePopover = jest.fn<Promise<void>, []>();
const mockOpenUrlExternal = jest.fn<void, [string]>();

jest.mock('@onekeyhq/components', () => {
  function Stack({
    children,
    onPress,
  }: {
    children?: ReactNode;
    onPress?: () => void;
  }) {
    if (onPress) {
      return (
        <button type="button" onClick={onPress}>
          {children}
        </button>
      );
    }
    return <div>{children}</div>;
  }

  return {
    Alert: () => null,
    Divider: () => null,
    Icon: () => null,
    IconButton: () => null,
    Popover: ({ renderContent }: { renderContent: ReactNode }) => renderContent,
    SizableText: Stack,
    Stack,
    XStack: Stack,
    YStack: Stack,
    usePopoverContext: () => ({ closePopover: mockClosePopover }),
    ...jest.requireActual<
      typeof import('@onekeyhq/components/src/actions/ActionList/runAfterClose')
    >('../../../../../components/src/actions/ActionList/runAfterClose'),
  };
});

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => jest.fn());
jest.mock('@onekeyhq/shared/src/locale', () => ({ ETranslations: {} }));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: true },
}));
jest.mock('@onekeyhq/shared/src/utils/openUrlUtils', () => ({
  openUrlExternal: (url: string) => mockOpenUrlExternal(url),
}));
jest.mock('../../../components/ListItem', () => ({ ListItem: () => null }));
jest.mock('../../../components/Token', () => ({ Token: () => null }));
jest.mock('../../Staking/components/ProtocolDetails/EarnIcon', () => ({
  EarnIcon: () => null,
}));
jest.mock('../../Staking/components/ProtocolDetails/EarnText', () => ({
  EarnText: ({ text }: { text?: { text?: string } }) => text?.text ?? null,
}));
jest.mock('../borrowUtils', () => ({ BorrowNavigation: {} }));

const bonusUrl = 'https://example.com/rewards';
const bonus: IBorrowReserveItem['overview']['platformBonus'] = {
  description: { text: 'Platform rewards' },
  totalReceived: {
    description: { text: '0' },
    button: { type: 'history', disabled: true, text: { text: 'History' } },
  },
  data: {
    icon: { icon: 'GiftOutline' },
    title: { text: 'Platform bonus' },
    endsIn: 0,
    rewards: [],
    button: {
      type: 'link',
      data: { link: bonusUrl },
      text: { text: 'View rewards' },
    },
  },
};

function renderBonusLink() {
  render(<BorrowBonusTooltip data={bonus} />);
  return screen.getByRole('button', { name: 'View rewards' });
}

beforeEach(() => {
  mockClosePopover.mockReset();
  mockOpenUrlExternal.mockReset();
  platformEnv.isNative = true;
});

it('opens the in-app browser only after the native sheet closes', async () => {
  let finishClose: (() => void) | undefined;
  mockClosePopover.mockReturnValue(
    new Promise<void>((resolve) => {
      finishClose = resolve;
    }),
  );

  fireEvent.click(renderBonusLink());

  expect(mockClosePopover).toHaveBeenCalledTimes(1);
  expect(mockOpenUrlExternal).not.toHaveBeenCalled();

  await act(async () => {
    finishClose?.();
  });

  expect(mockOpenUrlExternal).toHaveBeenCalledTimes(1);
  expect(mockOpenUrlExternal).toHaveBeenCalledWith(bonusUrl);
});

it('opens the browser once for repeated presses during one native close', async () => {
  const close = Promise.withResolvers<void>();
  mockClosePopover.mockReturnValue(close.promise);

  const link = renderBonusLink();
  fireEvent.click(link);
  fireEvent.click(link);
  expect(mockClosePopover).toHaveBeenCalledTimes(1);
  expect(mockOpenUrlExternal).not.toHaveBeenCalled();

  await act(async () => close.resolve());
  expect(mockOpenUrlExternal).toHaveBeenCalledTimes(1);
});

it('skips the browser when the native close is canceled', async () => {
  const { OverlayCloseCancelledError } = jest.requireActual<
    typeof import('@onekeyhq/components/src/shared/overlayCloseCancellation')
  >('../../../../../components/src/shared/overlayCloseCancellation');
  mockClosePopover.mockRejectedValue(
    new OverlayCloseCancelledError('reopened'),
  );

  const link = renderBonusLink();
  await act(async () => {
    fireEvent.click(link);
  });

  expect(mockClosePopover).toHaveBeenCalledTimes(1);
  expect(mockOpenUrlExternal).not.toHaveBeenCalled();
});

it('opens the web link in the click even while the popover is closing', async () => {
  platformEnv.isNative = false;
  let finishClose: (() => void) | undefined;
  mockClosePopover.mockReturnValue(
    new Promise<void>((resolve) => {
      finishClose = resolve;
    }),
  );

  fireEvent.click(renderBonusLink());

  expect(mockClosePopover).toHaveBeenCalledTimes(1);
  expect(mockOpenUrlExternal).toHaveBeenCalledWith(bonusUrl);

  await act(async () => {
    finishClose?.();
  });
});
