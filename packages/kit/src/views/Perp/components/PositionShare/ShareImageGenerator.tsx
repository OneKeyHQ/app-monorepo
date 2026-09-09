import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Stack } from '@onekeyhq/components';
import { drawDotQRCodeOnCanvas } from '@onekeyhq/kit/src/utils/qrCodeCanvas';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { getHyperliquidTokenImageUris } from '@onekeyhq/shared/src/utils/perpsUtils';

import {
  BACKGROUNDS,
  SHOW_REFERRAL_CODE,
  getCanvasConfig,
  getPnlDisplayInfo,
  getSharePriceLabelIds,
} from './constants';

import type {
  IShareConfig,
  IShareData,
  IShareImageGeneratorRef,
} from './types';

interface IShareImageGeneratorProps {
  data: IShareData;
  config: IShareConfig;
  referralQrCodeUrl?: string;
  referralDisplayText?: string;
  isReferralReady?: boolean;
}

const imageCache = new Map<string, HTMLImageElement>();

function toCanvasFont(size: number, weight: string | number = 'bold'): string {
  return `${weight} ${size}px MiSans, system-ui, -apple-system, sans-serif`;
}

// A stalled CDN response fires neither load nor error, so without a deadline the
// whole card generation would hang. Mirrors the native capture timeout.
const IMAGE_LOAD_TIMEOUT_MS = 3000;

function loadImage(src: string): Promise<HTMLImageElement | null> {
  if (imageCache.has(src)) {
    return Promise.resolve(imageCache.get(src) ?? null);
  }

  return new Promise((resolve) => {
    const img = new Image();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const settle = (result: HTMLImageElement | null) => {
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }
      img.onload = null;
      img.onerror = null;
      resolve(result);
    };
    timer = setTimeout(() => settle(null), IMAGE_LOAD_TIMEOUT_MS);
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageCache.set(src, img);
      settle(img);
    };
    img.onerror = () => settle(null);
    img.src = src;
  });
}

const CANVAS_CONFIG = getCanvasConfig(900);

export const ShareImageGenerator = forwardRef<
  IShareImageGeneratorRef,
  IShareImageGeneratorProps
>(
  (
    {
      data,
      config,
      referralQrCodeUrl,
      referralDisplayText,
      // Kept so this signature stays interchangeable with the native generator.
      // Readiness no longer gates drawing: the referral block always paints.
      isReferralReady: _isReferralReady,
    },
    ref,
  ) => {
    const intl = useIntl();
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
        mode,
        token,
        tokenDisplayName,
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
      // Same reasoning as ShareContentRenderer.
      const tokenImage =
        tokenImageUrl ||
        getHyperliquidTokenImageUris(
          mode !== 'spot' && token ? token : tokenDisplayName,
        )[0];
      const pnlDisplayText = getPnlDisplayInfo(data, config.pnlDisplayMode);
      const pnlFontSize =
        pnlDisplayText.length > 6
          ? fonts.pnl * (1 - (pnlDisplayText.length - 6) * 0.06)
          : fonts.pnl;
      const { entryPriceLabelId, markPriceLabelId } = getSharePriceLabelIds({
        mode,
        priceType,
      });

      const selectedBackground = isProfit
        ? BACKGROUNDS.profit[0]
        : BACKGROUNDS.loss[0];
      try {
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
            tokenDisplayName,
            padding + layout.tokenSize + layout.tokenOffsetX,
            tokenY,
          );

          ctx.textBaseline = 'alphabetic';
        }

        if (display.showSideAndLeverage) {
          // Calculate position
          const coinNameWidth = ctx.measureText(tokenDisplayName).width;
          const textX =
            padding +
            layout.tokenSize +
            layout.tokenOffsetX +
            coinNameWidth +
            layout.tokenSpacing;
          const textY = tokenY;

          // Measure text
          ctx.font = toCanvasFont(fonts.side, 600);
          const isSpot = mode === 'spot';
          const isLong = side === 'long';
          let sideLabelId: ETranslations;
          if (isSpot) {
            sideLabelId = isLong
              ? ETranslations.global_buy
              : ETranslations.global_sell;
          } else {
            sideLabelId = isLong
              ? ETranslations.perp_long
              : ETranslations.perp_short;
          }
          const sideTranslation = intl.formatMessage({
            id: sideLabelId,
          });
          const sideText = isSpot
            ? sideTranslation
            : `${sideTranslation} ${leverage}X`;
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
              intl.formatMessage({
                id: entryPriceLabelId,
              }),
              padding,
              entryPriceY,
            );
            ctx.globalAlpha = 1;
            ctx.fillStyle = colors.textPrimary;
            ctx.font = toCanvasFont(fonts.priceValue, 'bold');
            ctx.fillText(
              entryPrice,
              padding,
              entryPriceY + layout.priceSpacingY,
            );
          }

          if (display.showMarkPrice) {
            const markPriceY = layout.markPriceY;
            ctx.fillStyle = colors.textSecondary;
            ctx.font = toCanvasFont(fonts.priceLabel);
            ctx.globalAlpha = layout.labelOpacity;
            ctx.fillText(
              intl.formatMessage({
                id: markPriceLabelId,
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

        // Always painted: referralQrCodeUrl carries a working default, so
        // waiting for the invite code would only delay the card.
        if (SHOW_REFERRAL_CODE) {
          const rectHeight = layout.referralHeight;
          const rectY = size - rectHeight;
          const rectWidth = size;

          ctx.fillStyle = colors.referralBackground;
          ctx.fillRect(0, rectY, rectWidth, rectHeight);
          ctx.filter = 'none';

          const qrCodePadding = 5;
          const qrCodeOuterSize = layout.qrCodeSize;
          const qrCodeInnerSize = qrCodeOuterSize - qrCodePadding * 2;
          const qrCodeY = rectY + (rectHeight - qrCodeOuterSize) / 2;
          const qrCodeX = size - padding - qrCodeOuterSize;

          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(qrCodeX, qrCodeY, qrCodeOuterSize, qrCodeOuterSize);

          try {
            await drawDotQRCodeOnCanvas(ctx, {
              value: referralQrCodeUrl ?? '',
              x: qrCodeX + qrCodePadding,
              y: qrCodeY + qrCodePadding,
              size: qrCodeInnerSize,
            });
          } catch (error) {
            if (platformEnv.isDev) {
              console.error('Failed to generate QR code:', error);
            }
          }

          ctx.fillStyle = colors.textTertiary;
          ctx.textBaseline = 'middle';
          ctx.font = toCanvasFont(fonts.priceLabel);
          ctx.globalAlpha = layout.labelOpacity;
          ctx.fillText(
            intl.formatMessage({
              id: ETranslations.perp_share_referral_desc,
            }),
            padding,
            rectY + rectHeight / 2 - layout.referralOffset,
          );
          ctx.globalAlpha = 1;
          ctx.font = toCanvasFont(fonts.priceValue);
          const referralTextX = padding;
          ctx.fillText(
            referralDisplayText ?? '',
            referralTextX,
            rectY + rectHeight / 2 + layout.referralOffset,
          );
          ctx.textBaseline = 'alphabetic';
        }

        return canvas.toDataURL('image/png', 1.0);
      } catch (error) {
        if (platformEnv.isDev) {
          console.error('Failed to generate image:', error);
        }
        return '';
      }
    }, [data, config, referralQrCodeUrl, referralDisplayText, intl]);

    useImperativeHandle(ref, () => ({ generate }));

    return (
      <Stack
        position="absolute"
        left={-9999}
        top={0}
        opacity={0}
        pointerEvents="none"
        zIndex={-1}
      >
        <canvas
          ref={canvasRef}
          width={CANVAS_CONFIG.size}
          height={CANVAS_CONFIG.size}
        />
      </Stack>
    );
  },
);

ShareImageGenerator.displayName = 'ShareImageGenerator';
