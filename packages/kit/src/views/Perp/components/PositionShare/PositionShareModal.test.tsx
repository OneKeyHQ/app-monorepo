/** @jest-environment jsdom */
import type { ReactNode } from 'react';

import { act, fireEvent, render } from '@testing-library/react';
import { IntlProvider, createIntl } from 'react-intl';

import type {
  IPerpShareActionClickParams,
  IPerpShareParams,
} from '@onekeyhq/shared/src/logger/scopes/perp/type';

import { showPositionShareDialog } from './PositionShareModal';

import type { ControlPanel } from './ControlPanel';
import type { IShareData } from './types';

const mockDialogShow = jest.fn<
  { close: () => void },
  [{ onVisible: () => void; renderContent: ReactNode }]
>();
const mockDialogOpen = jest.fn<void, [IPerpShareParams]>();
const mockActionClick = jest.fn<void, [IPerpShareActionClickParams]>();
const mockWaitForReferral = jest.fn<Promise<void>, []>();
const mockCopyLink = jest.fn<void, []>();
let mockIsNativeIOS = false;

jest.mock('@onekeyhq/components', () => {
  const Stack = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Dialog: {
      show: (...args: Parameters<typeof mockDialogShow>) =>
        mockDialogShow(...args),
    },
    Stack,
    YStack: Stack,
    ScrollView: Stack,
    Toast: { error: jest.fn() },
  };
});
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    perp: {
      common: {
        perpShareDialogOpen: (params: IPerpShareParams) =>
          mockDialogOpen(params),
        perpShareActionClick: (params: IPerpShareActionClickParams) =>
          mockActionClick(params),
      },
    },
  },
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    get isNativeIOS() {
      return mockIsNativeIOS;
    },
    get isNative() {
      return mockIsNativeIOS;
    },
  },
}));
jest.mock('@onekeyhq/shared/src/utils/openUrlUtils', () => ({
  openSettings: jest.fn(),
}));
jest.mock('@onekeyhq/shared/src/utils/timerUtils', () => ({
  __esModule: true,
  default: { sleepUntil: () => mockWaitForReferral() },
}));
jest.mock('../../PerpsProviderMirror', () => ({
  PerpsProviderMirror: ({ children }: { children?: ReactNode }) => (
    <>{children}</>
  ),
}));
jest.mock('./ShareView', () => ({ ShareView: () => null }));
jest.mock('./ShareImageGenerator', () => ({ ShareImageGenerator: () => null }));
jest.mock('./constants', () => ({
  DEFAULT_PNL_DISPLAY_MODE: 'pnl',
  getDefaultShareText: () => 'Share',
}));
jest.mock('./useReferralUrl', () => ({
  useReferralUrl: () => ({ isReady: true }),
}));
jest.mock('./useShareActions', () => ({
  useShareActions: () => ({ copyLink: mockCopyLink }),
}));
jest.mock('./ControlPanel', () => ({
  ControlPanel: ({
    onSaveImage,
    onShareImage,
    onCopyLink,
    onShareToX,
  }: Parameters<typeof ControlPanel>[0]) => (
    <>
      <button type="button" onClick={onSaveImage}>
        save
      </button>
      <button type="button" onClick={onShareImage}>
        share
      </button>
      <button type="button" onClick={onCopyLink}>
        copy
      </button>
      <button type="button" onClick={onShareToX}>
        x
      </button>
    </>
  ),
}));

const intl = createIntl({ locale: 'en', onError: () => {} });
const data: IShareData = {
  side: 'long',
  token: 'ETH',
  tokenDisplayName: 'ETH',
  pnl: '1',
  pnlPercent: '1',
  leverage: 10,
  entryPrice: '100',
  markPrice: '101',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockIsNativeIOS = false;
  mockWaitForReferral.mockResolvedValue(undefined);
  mockDialogShow.mockReturnValue({ close: jest.fn() });
});

it.each(['position', 'tradeHistory', 'spotHolding'] as const)(
  'records %s only when the dialog becomes visible and deduplicates repeated callbacks',
  (source) => {
    showPositionShareDialog(data, intl, source);
    expect(mockDialogOpen).not.toHaveBeenCalled();
    const { onVisible } = mockDialogShow.mock.calls[0][0] as {
      onVisible: () => void;
    };
    onVisible();
    onVisible();
    expect(mockDialogOpen).toHaveBeenCalledTimes(1);
    expect(mockDialogOpen).toHaveBeenCalledWith({ source });
    showPositionShareDialog(data, intl, source);
    const second = mockDialogShow.mock.calls[1][0] as { onVisible: () => void };
    second.onVisible();
    expect(mockDialogOpen).toHaveBeenCalledTimes(2);
  },
);

it.each([false, true])(
  'records actions before preparation even without an image generator (native=%s)',
  async (isNative) => {
    mockIsNativeIOS = isNative;
    showPositionShareDialog(data, intl, 'tradeHistory');
    const { renderContent } = mockDialogShow.mock.calls[0][0] as {
      renderContent: ReactNode;
    };
    const screen = render(
      <IntlProvider locale="en" onError={() => {}}>
        <>{renderContent}</>
      </IntlProvider>,
    );
    for (const shareMethod of ['save', 'share', 'copy', 'x']) {
      mockActionClick.mockClear();
      mockWaitForReferral.mockClear();
      await act(async () => {
        fireEvent.click(screen.getByText(shareMethod));
      });
      expect(mockActionClick).toHaveBeenCalledTimes(1);
      expect(mockActionClick).toHaveBeenCalledWith({
        source: 'tradeHistory',
        shareMethod,
      });
      expect(mockActionClick.mock.invocationCallOrder[0]).toBeLessThan(
        mockWaitForReferral.mock.invocationCallOrder[0],
      );
    }
    expect(mockCopyLink).toHaveBeenCalledTimes(1);
  },
);
