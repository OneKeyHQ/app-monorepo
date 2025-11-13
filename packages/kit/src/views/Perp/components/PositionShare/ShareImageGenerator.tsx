import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';

import BigNumber from 'bignumber.js';
import QRCodeUtil from 'qrcode';

import { Stack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { getHyperliquidTokenImageUrl } from '@onekeyhq/shared/src/utils/perpsUtils';

import {
  BACKGROUNDS,
  REFERRAL_CODE,
  SHOW_REFERRAL_CODE,
  getCanvasConfig,
  getPnlDisplayInfo,
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

function loadImage(src: string): Promise<HTMLImageElement | null> {
  if (imageCache.has(src)) {
    return Promise.resolve(imageCache.get(src) ?? null);
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageCache.set(src, img);
      resolve(img);
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export const ShareImageGenerator = forwardRef<
  IShareImageGeneratorRef,
  IShareImageGeneratorProps
>(({ data, config }, ref) => {
  const CANVAS_CONFIG = getCanvasConfig(900);
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
      leverage,
      entryPrice,
      markPrice,
      priceType = 'mark',
    } = data;
    const pnlBn = new BigNumber(pnl || '0');
    const isProfit = pnlBn.isGreaterThan(0);
    const pnlColor = isProfit ? colors.long : colors.short;
    const tokenImage = tokenImageUrl || getHyperliquidTokenImageUrl(token);
    const pnlDisplayText = getPnlDisplayInfo(data, config.pnlDisplayMode);
    const pnlFontSize =
      pnlDisplayText.length > 8
        ? fonts.pnl * (1 - (pnlDisplayText.length - 8) * 0.05)
        : fonts.pnl;

    const selectedBackground = isProfit
      ? BACKGROUNDS.profit[0]
      : BACKGROUNDS.loss[1];
    try {
      // Sticker temporarily disabled
      // const selectedSticker =
      //   config.stickerIndex !== null ? STICKERS[config.stickerIndex] : null;

      const [bgImg, tokenImg] = await Promise.all([
        selectedBackground ? loadImage(selectedBackground) : null,
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
        const imgCenterX = padding + layout.tokenSize / 2;
        const imgCenterY = tokenY;
        const radius = layout.tokenSize / 2;

        ctx.save();
        ctx.fillStyle = '#f8f8f8';
        ctx.beginPath();
        ctx.arc(imgCenterX, imgCenterY, radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(imgCenterX, imgCenterY, radius, 0, Math.PI * 2);
        ctx.clip();

        ctx.drawImage(
          tokenImg,
          padding,
          imgCenterY - layout.tokenSize / 2,
          layout.tokenSize,
          layout.tokenSize,
        );

        ctx.restore();
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
        // Calculate position
        const coinNameWidth = ctx.measureText(token).width;
        const textX =
          padding +
          layout.tokenSize +
          layout.tokenOffsetX +
          coinNameWidth +
          layout.tokenSpacing;
        const textY = tokenY;

        // Measure text
        ctx.font = toCanvasFont(fonts.side, 600);
        const sideTranslation = appLocale.intl.formatMessage({
          id:
            side === 'long'
              ? ETranslations.perp_long
              : ETranslations.perp_short,
        });
        const sideText = `${sideTranslation} ${leverage}X`;
        const textWidth = ctx.measureText(sideText).width;

        // Background rectangle size
        const bgWidth = textWidth + layout.badgePaddingX * 2;
        const bgHeight = fonts.side + layout.badgePaddingY * 2;

        // Align background center with text
        const bgX = textX - layout.badgePaddingX;
        const bgY = textY - bgHeight / 2;

        // Draw background
        ctx.fillStyle =
          side === 'long'
            ? colors.sideLongBackground
            : colors.sideShortBackground;

        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(bgX, bgY, bgWidth, bgHeight, layout.badgeRadius);
        } else {
          ctx.rect(bgX, bgY, bgWidth, bgHeight);
        }
        ctx.fill();

        // Set text vertical center alignment
        ctx.textBaseline = 'middle';
        ctx.fillStyle = side === 'long' ? colors.long : colors.short;
        ctx.fillText(sideText, textX, textY);

        // Restore default baseline
        ctx.textBaseline = 'alphabetic';
      }
      if (display.showPnl) {
        const pnlY = layout.pnlY;
        ctx.fillStyle = pnlColor;
        ctx.font = toCanvasFont(pnlFontSize, 'bold');
        ctx.textBaseline = 'middle';
        ctx.fillText(pnlDisplayText, padding, pnlY);
        ctx.textBaseline = 'alphabetic';

        if (display.showEntryPrice) {
          const entryPriceY = layout.entryPriceY;
          ctx.fillStyle = colors.textSecondary;
          ctx.font = toCanvasFont(fonts.priceLabel);
          ctx.globalAlpha = layout.labelOpacity;
          ctx.fillText(
            appLocale.intl.formatMessage({
              id: ETranslations.perp_position_entry_price,
            }),
            padding,
            entryPriceY,
          );
          ctx.globalAlpha = 1;
          ctx.fillStyle = colors.textPrimary;
          ctx.font = toCanvasFont(fonts.priceValue, 'bold');
          ctx.fillText(entryPrice, padding, entryPriceY + layout.priceSpacingY);
        }

        if (display.showMarkPrice) {
          const markPriceY = layout.markPriceY;
          ctx.fillStyle = colors.textSecondary;
          ctx.font = toCanvasFont(fonts.priceLabel);
          ctx.globalAlpha = layout.labelOpacity;
          ctx.fillText(
            priceType === 'exit'
              ? 'Exit Price'
              : appLocale.intl.formatMessage({
                  id: ETranslations.perp_position_mark_price,
                }),
            padding,
            markPriceY,
          );
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
        // Define bottom rectangle size and position
        const rectHeight = layout.referralHeight;
        const rectY = size - rectHeight;
        const rectWidth = size;

        ctx.fillStyle = colors.referralBackground;
        ctx.fillRect(0, rectY, rectWidth, rectHeight);
        ctx.filter = 'none';

        // Generate QR code (positioned at bottom right)
        const qrCodeSize = layout.qrCodeSize;
        const qrCodeY = rectY + (rectHeight - qrCodeSize) / 2;
        const qrCodeX = size - padding - qrCodeSize;

        try {
          const qrCodeDataUrl = await QRCodeUtil.toDataURL(REFERRAL_CODE, {
            width: qrCodeSize,
            margin: 1,
            color: {
              dark: '#FFFFFF',
              light: '#00000000',
            },
          });

          const qrCodeImg = await loadImage(qrCodeDataUrl);
          if (qrCodeImg) {
            ctx.drawImage(qrCodeImg, qrCodeX, qrCodeY, qrCodeSize, qrCodeSize);
          }
        } catch (error) {
          console.error('Failed to generate QR code:', error);
        }

        // Draw referral code text (positioned at bottom left, next to QR code)
        ctx.fillStyle = colors.textTertiary;
        ctx.textBaseline = 'middle';
        ctx.font = toCanvasFont(fonts.priceLabel);
        ctx.globalAlpha = layout.labelOpacity;
        // ctx.fillText(
        //   appLocale.intl.formatMessage({
        //     id: ETranslations.referral_referral_link,
        //   }),
        //   padding,
        //   rectY + rectHeight / 2 - layout.referralOffset,
        // );
        ctx.globalAlpha = 1;
        ctx.font = toCanvasFont(fonts.priceValue);
        const referralTextX = padding;
        ctx.fillText(
          REFERRAL_CODE,
          referralTextX,
          rectY + rectHeight / 2 + layout.referralOffset,
        );
        ctx.textBaseline = 'alphabetic';
      }

      // Sticker temporarily disabled
      // if (selectedSticker) {
      //   ctx.font = toCanvasFont(layout.stickerSize);
      //   ctx.textBaseline = 'bottom';
      //   ctx.fillText(
      //     selectedSticker,
      //     size - padding - layout.stickerSize,
      //     size - padding,
      //   );
      // }

      return canvas.toDataURL('image/png', 1.0);
    } catch (error) {
      console.error('Failed to generate image:', error);
      return '';
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
