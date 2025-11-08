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

function toCanvasFont(size: number, weight: string | number = 'bold'): string {
  return `${weight} ${size}px MiSans`;
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

      const tokenY = layout.tokenY;
      if (tokenImg) {
        const imgCenterY = tokenY; // 与文字相同的中心线

        ctx.drawImage(
          tokenImg,
          padding,
          imgCenterY - layout.tokenSize / 2,
          layout.tokenSize,
          layout.tokenSize,
        );
      }

      if (display.showCoinName) {
        ctx.fillStyle = colors.textPrimary;
        ctx.font = toCanvasFont(fonts.coin, 600);
        ctx.textBaseline = 'middle';

        ctx.fillText(
          token,
          padding + layout.tokenSize + layout.tokenOffsetX,
          tokenY,
        );

        ctx.textBaseline = 'alphabetic';
      }

      if (display.showSideAndLeverage) {
        // 计算位置
        const coinNameWidth = ctx.measureText(token).width;
        const spacing = 40;
        const textX =
          padding +
          layout.tokenSize +
          layout.tokenOffsetX +
          coinNameWidth +
          spacing;
        const textY = tokenY;

        // 测量文字
        ctx.font = toCanvasFont(fonts.side, 600);
        const sideText = `${side.toUpperCase()} ${leverage}X`;
        const textWidth = ctx.measureText(sideText).width;

        // 背景配置
        const bgPaddingX = 20;
        const bgPaddingY = 18;
        const borderRadius = 58;

        // 背景矩形尺寸
        const bgWidth = textWidth + bgPaddingX * 2;
        const bgHeight = fonts.side + bgPaddingY * 2;

        // 关键：背景的中心点与文字对齐
        const bgX = textX - bgPaddingX;
        const bgY = textY - bgHeight / 2; // 改为以文字Y坐标为中心

        // 绘制背景
        ctx.fillStyle = side === 'long' ? '#0C5300' : '#630A0A';

        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(bgX, bgY, bgWidth, bgHeight, borderRadius);
        } else {
          ctx.rect(bgX, bgY, bgWidth, bgHeight);
        }
        ctx.fill();

        // 设置文字垂直居中绘制
        ctx.textBaseline = 'middle'; // 🔑 关键：让文字基线为中间
        ctx.fillStyle = side === 'long' ? colors.long : colors.short;
        ctx.fillText(sideText, textX, textY);

        // 恢复默认基线（避免影响后续文字）
        ctx.textBaseline = 'alphabetic';
      }
      if (display.showPnl) {
        const pnlY = layout.pnlY;
        ctx.fillStyle = pnlColor;
        ctx.font = toCanvasFont(fonts.pnl, 'bold');
        ctx.textBaseline = 'middle';
        ctx.fillText(`${pnlSign}${pnlPercent}%`, padding, pnlY);
        ctx.textBaseline = 'alphabetic';

        if (display.showEntryPrice) {
          const entryPriceY = layout.entryPriceY;
          ctx.fillStyle = colors.textSecondary;
          ctx.font = toCanvasFont(fonts.priceLabel);
          ctx.globalAlpha = 0.5;
          ctx.fillText('Entry Price', padding, entryPriceY);
          ctx.globalAlpha = 1;
          ctx.fillStyle = colors.textPrimary;
          ctx.font = toCanvasFont(fonts.priceValue, 'bold');
          ctx.fillText(entryPrice, padding, entryPriceY + layout.priceSpacingY);
        }

        if (display.showMarkPrice) {
          const markPriceY = layout.markPriceY;
          ctx.fillStyle = colors.textSecondary;
          ctx.font = toCanvasFont(fonts.priceLabel);
          ctx.globalAlpha = 0.5;
          ctx.fillText('Mark Price', padding, markPriceY);
          ctx.globalAlpha = 1;
          ctx.fillStyle = colors.textPrimary;
          ctx.font = toCanvasFont(fonts.priceValue, 'bold');
          ctx.fillText(
            markPrice || '0',
            padding,
            markPriceY + layout.priceSpacingY,
          );
        }
      }

      if (SHOW_REFERRAL_CODE) {
        // 1. 定义底部矩形的尺寸和位置
        const rectHeight = 216; // 矩形高度

        // 矩形位置：贴近底部
        const rectY = size - rectHeight; // 从底部向上 padding 距离

        const rectWidth = size;

        ctx.fillStyle = colors.referralBackground;
        ctx.fillRect(0, rectY, rectWidth, rectHeight);
        ctx.filter = 'none';

        ctx.fillStyle = colors.textTertiary;
        ctx.textBaseline = 'middle';
        ctx.font = toCanvasFont(fonts.priceLabel);
        ctx.globalAlpha = 0.5;
        ctx.fillText('Referral Code', padding, rectY + rectHeight / 2 - 20);
        ctx.globalAlpha = 1;
        ctx.font = toCanvasFont(fonts.priceValue);
        ctx.fillText(REFERRAL_CODE, padding, rectY + rectHeight / 2 + 20);
        ctx.textBaseline = 'alphabetic';
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
