import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';

import { Stack } from '@onekeyhq/components';
import { getHyperliquidTokenImageUrl } from '@onekeyhq/shared/src/utils/perpsUtils';

import {
  BACKGROUNDS,
  CANVAS_CONFIG,
  REFERRAL_CODE,
  SHOW_REFERRAL_CODE,
  STICKERS,
} from './constants';

import type {
  IShareConfig,
  IShareData,
  IShareImageGeneratorRef,
} from './types';

interface IShareImageGeneratorProps {
  data: IShareData;
  config: IShareConfig;
}

const imageCache = new Map<string, HTMLImageElement>();

function toCanvasFont(
  size: number,
  weight: 'normal' | 'bold' = 'normal',
): string {
  return `${weight} ${size}px Inter`;
}

function loadImage(src: string | number): Promise<HTMLImageElement | null> {
  const srcStr = typeof src === 'number' ? String(src) : src;
  if (imageCache.has(srcStr)) {
    return Promise.resolve(imageCache.get(srcStr) ?? null);
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageCache.set(srcStr, img);
      resolve(img);
    };
    img.onerror = () => resolve(null);
    img.src = srcStr;
  });
}

export const ShareImageGenerator = forwardRef<
  IShareImageGeneratorRef,
  IShareImageGeneratorProps
>(({ data, config }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const generate = useCallback(async (): Promise<string> => {
    const canvas = canvasRef.current;
    if (!canvas) return '';

    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    const { size, padding, colors, fonts, layout, display } = CANVAS_CONFIG;
    canvas.width = size;
    canvas.height = size;

    const {
      side,
      token,
      tokenImageUrl,
      pnl,
      pnlPercent,
      leverage,
      entryPrice,
      markPrice,
    } = data;
    const pnlNum = parseFloat(pnl);
    const pnlPercentNum = parseFloat(pnlPercent);
    const pnlColor = pnlNum >= 0 ? colors.long : colors.short;
    const pnlSign = pnlPercentNum >= 0 ? '+' : '';
    const tokenImage = tokenImageUrl || getHyperliquidTokenImageUrl(token);

    const isProfit = pnlNum >= 0;
    const availableBackgrounds = isProfit
      ? BACKGROUNDS.profit
      : BACKGROUNDS.loss;
    const allBackgrounds = [...BACKGROUNDS.neutral, ...availableBackgrounds];
    const selectedBackground = allBackgrounds[config.backgroundIndex];

    try {
      const selectedSticker =
        config.stickerIndex !== null ? STICKERS[config.stickerIndex] : null;

      const [bgImg, tokenImg] = await Promise.all([
        selectedBackground
          ? loadImage(
              typeof selectedBackground === 'number'
                ? selectedBackground
                : String(selectedBackground),
            )
          : null,
        display.showTokenIcon ? loadImage(tokenImage) : null,
      ]);

      if (bgImg) {
        ctx.drawImage(bgImg, 0, 0, size, size);
      } else {
        const gradient = ctx.createLinearGradient(0, 0, 0, size);
        gradient.addColorStop(0, colors.background[0]);
        gradient.addColorStop(0.5, colors.background[1]);
        gradient.addColorStop(1, colors.background[2]);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);
      }

      const tokenY = padding + layout.tokenY;
      if (tokenImg) {
        ctx.drawImage(
          tokenImg,
          padding,
          tokenY - layout.tokenSize / 2,
          layout.tokenSize,
          layout.tokenSize,
        );
      }

      if (display.showCoinName) {
        ctx.fillStyle = colors.textPrimary;
        ctx.font = toCanvasFont(fonts.coin, 'bold');
        ctx.fillText(
          token,
          padding + layout.tokenSize + layout.tokenOffsetX,
          tokenY + layout.tokenOffsetY,
        );
      }

      if (display.showSideAndLeverage) {
        ctx.fillStyle = side === 'long' ? colors.long : colors.short;
        ctx.font = toCanvasFont(fonts.side, 'bold');
        ctx.fillText(
          `${side.toUpperCase()} ${leverage}X`,
          padding + layout.tokenSize + layout.tokenOffsetX,
          tokenY + layout.sideOffsetY,
        );
      }

      if (display.showPnl) {
        const pnlY = size / 2 + layout.pnlYOffset;
        ctx.fillStyle = pnlColor;
        ctx.font = toCanvasFont(fonts.pnl, 'bold');
        ctx.fillText(`${pnlSign}${pnlPercent}%`, padding, pnlY);

        if (display.showEntryPrice) {
          ctx.fillStyle = colors.textSecondary;
          ctx.font = toCanvasFont(fonts.priceLabel);
          ctx.fillText('Entry Price', padding, pnlY + layout.priceSpacingY);
          ctx.fillStyle = colors.textPrimary;
          ctx.font = toCanvasFont(fonts.priceValue, 'bold');
          ctx.fillText(
            entryPrice,
            padding + layout.priceValueOffsetX,
            pnlY + layout.priceSpacingY,
          );
        }

        if (display.showMarkPrice) {
          ctx.fillStyle = colors.textSecondary;
          ctx.font = toCanvasFont(fonts.priceLabel);
          ctx.fillText('Mark Price', padding, pnlY + layout.priceSpacingY + 80);
          ctx.fillStyle = colors.textPrimary;
          ctx.font = toCanvasFont(fonts.priceValue, 'bold');
          ctx.fillText(
            markPrice || '0',
            padding + layout.priceValueOffsetX,
            pnlY + layout.priceSpacingY + 80,
          );
        }
      }

      if (SHOW_REFERRAL_CODE) {
        ctx.fillStyle = colors.textTertiary;
        ctx.font = toCanvasFont(fonts.referral);
        ctx.fillText(
          REFERRAL_CODE,
          padding,
          size - padding - layout.referralBottomOffset,
        );
      }

      if (selectedSticker) {
        ctx.font = `${layout.stickerSize}px system-ui, -apple-system, sans-serif`;
        ctx.textBaseline = 'bottom';
        ctx.fillText(
          selectedSticker,
          size - padding - layout.stickerSize,
          size - padding,
        );
      }

      return canvas.toDataURL('image/png', 1.0);
    } catch (error) {
      console.error('Failed to generate image:', error);
      return '';
    }
  }, [data, config]);

  useImperativeHandle(ref, () => ({ generate }));

  return (
    <Stack position="absolute" opacity={0} pointerEvents="none">
      <canvas
        ref={canvasRef}
        width={CANVAS_CONFIG.size}
        height={CANVAS_CONFIG.size}
      />
    </Stack>
  );
});

ShareImageGenerator.displayName = 'ShareImageGenerator';
