/** @jest-environment jsdom */
import { createRef } from 'react';
import type { ReactNode } from 'react';

import { act, render } from '@testing-library/react';

import { drawDotQRCodeOnCanvas } from '@onekeyhq/kit/src/utils/qrCodeCanvas';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { getCanvasConfig } from './constants';
import { ShareImageGenerator } from './ShareImageGenerator';

import type {
  IShareConfig,
  IShareData,
  IShareImageGeneratorRef,
} from './types';

const description =
  'Tradez des contrats perpétuels on-chain avec un effet de levier allant jusqu’à 40x, sans inscription.';
jest.mock('@onekeyhq/components', () => ({
  Stack: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) =>
      id === ETranslations.perp_share_referral_desc ? description : id,
  }),
}));
jest.mock('@onekeyhq/kit/src/utils/qrCodeCanvas', () => ({
  drawDotQRCodeOnCanvas: jest.fn().mockResolvedValue(undefined),
  drawQRCodeBrandMark: jest.fn(),
  drawRoundedRect: jest.fn(),
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false },
}));
jest.mock('@onekeyhq/shared/src/utils/perpsUtils', () => ({
  getHyperliquidTokenImageUris: () => ['https://example.com/token.png'],
}));

const data: IShareData = {
  side: 'long',
  token: 'ETH',
  tokenDisplayName: 'ETH',
  pnl: '-1',
  pnlPercent: '-1',
  leverage: 2,
  entryPrice: '100',
  markPrice: '99',
};
const config: IShareConfig = {
  customText: '',
  stickerIndex: null,
  backgroundIndex: 0,
  pnlDisplayMode: 'roe',
};

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

it('bounds long localized footer text before the QR plate in the exported canvas', async () => {
  jest.useFakeTimers();
  const fillText = jest.fn<void, [string, number, number, number?]>();
  const ctx = {
    fillText,
    fillRect: jest.fn(),
    beginPath: jest.fn(),
    roundRect: jest.fn(),
    rect: jest.fn(),
    fill: jest.fn(),
    arc: jest.fn(),
    measureText: jest.fn(() => ({ width: 789 })),
    createLinearGradient: jest.fn(() => ({ addColorStop: jest.fn() })),
  };
  const canvasPrototype: {
    getContext: (contextId: '2d') => CanvasRenderingContext2D | null;
  } = HTMLCanvasElement.prototype;
  jest
    .spyOn(canvasPrototype, 'getContext')
    .mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
  jest
    .spyOn(HTMLCanvasElement.prototype, 'toDataURL')
    .mockReturnValue('data:image/png;base64,fixture');
  const ref = createRef<IShareImageGeneratorRef>();
  render(
    <ShareImageGenerator
      ref={ref}
      data={data}
      config={config}
      referralQrCodeUrl="https://onekey.so/perps"
      referralDisplayText="ABC123"
    />,
  );
  let image: string | undefined;
  await act(async () => {
    const pending = ref.current?.generate();
    await jest.advanceTimersByTimeAsync(3000);
    image = await pending;
  });
  expect(image).toBe('data:image/png;base64,fixture');
  expect(drawDotQRCodeOnCanvas).toHaveBeenCalled();
  const { size, padding, layout } = getCanvasConfig(900);
  const qrPlateLeft = size - padding - layout.qrCodeSize;
  for (const text of [description, 'ABC123']) {
    const call = fillText.mock.calls.find(([value]) => value === text);
    expect(call).toBeDefined();
    const [, x, , maxWidth] = call!;
    expect(maxWidth).toBeGreaterThan(0);
    expect(maxWidth).toBeLessThan(789);
    expect(x + maxWidth!).toBeLessThanOrEqual(
      qrPlateLeft - layout.qrCodeSpacing,
    );
  }
});
