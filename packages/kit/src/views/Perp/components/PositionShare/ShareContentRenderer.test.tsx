/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, fireEvent, render } from '@testing-library/react';

import { BACKGROUNDS } from './constants';
import { ShareContentRenderer } from './ShareContentRenderer';

import type { IShareConfig, IShareData } from './types';

jest.mock('@onekeyhq/components', () => {
  const Stack = ({
    children,
    backgroundColor,
  }: {
    children?: ReactNode;
    backgroundColor?: string;
  }) => <div style={{ backgroundColor }}>{children}</div>;
  return {
    Stack,
    XStack: Stack,
    YStack: Stack,
    SizableText: ({ children }: { children?: ReactNode }) => (
      <span>{children}</span>
    ),
    Image: ({
      source,
      onLoad,
      onError,
      loadingStrategy,
    }: {
      source: { uri: string };
      onLoad?: () => void;
      onError?: () => void;
      loadingStrategy?: string;
    }) => (
      <img
        alt={source.uri}
        src={source.uri}
        data-loading-strategy={loadingStrategy}
        onLoad={onLoad}
        onError={onError}
      />
    ),
    Spinner: () => <div role="progressbar" />,
    QRCode: () => <div />,
  };
});

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: true, isNativeIOS: true },
}));

jest.mock('@onekeyhq/shared/src/utils/perpsUtils', () => ({
  getHyperliquidTokenImageUris: () => ['https://example.com/token.png'],
}));

const data: IShareData = {
  side: 'long',
  token: 'xyz:NVDA',
  tokenDisplayName: 'NVDA',
  pnl: '-0.33',
  pnlPercent: '-1',
  leverage: 2,
  entryPrice: '214',
  markPrice: '213',
};
const config: IShareConfig = {
  customText: '',
  stickerIndex: null,
  backgroundIndex: 0,
  pnlDisplayMode: 'roe',
};

describe('native share background loading', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('covers the card until the background loads, independently of the token icon', () => {
    const view = render(
      <ShareContentRenderer data={data} config={config} waitForBackground />,
    );
    expect(view.queryByRole('progressbar')).not.toBeNull();
    fireEvent.load(view.getByAltText('https://example.com/token.png'));
    expect(view.queryByRole('progressbar')).not.toBeNull();
    fireEvent.load(view.getByAltText(BACKGROUNDS.loss[0]));
    expect(view.queryByRole('progressbar')).toBeNull();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('ends loading immediately on failure and keeps the dark fallback', () => {
    const view = render(
      <ShareContentRenderer data={data} config={config} waitForBackground />,
    );
    fireEvent.error(view.getByAltText(BACKGROUNDS.loss[0]));
    expect(view.queryByRole('progressbar')).toBeNull();
    expect(
      view
        .getByAltText(BACKGROUNDS.loss[0])
        .getAttribute('data-loading-strategy'),
    ).toBe('none');
    expect(view.container.firstElementChild).toHaveProperty(
      'style.backgroundColor',
      'rgb(26, 26, 26)',
    );
    expect(jest.getTimerCount()).toBe(0);
  });

  it('stops waiting after five seconds even if no image event arrives', () => {
    const view = render(
      <ShareContentRenderer data={data} config={config} waitForBackground />,
    );
    act(() => jest.advanceTimersByTime(4999));
    expect(view.queryByRole('progressbar')).not.toBeNull();
    act(() => jest.advanceTimersByTime(1));
    expect(view.queryByRole('progressbar')).toBeNull();
    fireEvent.load(view.getByAltText(BACKGROUNDS.loss[0]));
    expect(view.queryByRole('progressbar')).toBeNull();
  });

  it('waits for the new background when the card changes from loss to profit', () => {
    const view = render(
      <ShareContentRenderer data={data} config={config} waitForBackground />,
    );
    fireEvent.load(view.getByAltText(BACKGROUNDS.loss[0]));
    view.rerender(
      <ShareContentRenderer
        data={{ ...data, pnl: '0.33' }}
        config={config}
        waitForBackground
      />,
    );
    expect(view.queryByRole('progressbar')).not.toBeNull();
    fireEvent.load(view.getByAltText(BACKGROUNDS.profit[0]));
    expect(view.queryByRole('progressbar')).toBeNull();
  });

  it('cancels the deadline when the preview unmounts', () => {
    const view = render(
      <ShareContentRenderer data={data} config={config} waitForBackground />,
    );
    view.unmount();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('never captures a spinner in the export renderer', () => {
    const view = render(<ShareContentRenderer data={data} config={config} />);
    expect(view.queryByRole('progressbar')).toBeNull();
    expect(view.container.firstElementChild).toHaveProperty(
      'style.backgroundColor',
      'rgb(26, 26, 26)',
    );
    expect(jest.getTimerCount()).toBe(0);
  });
});
