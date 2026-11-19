import {
  forwardRef,
  memo,
  useCallback,
  useImperativeHandle,
  useRef,
} from 'react';

import { useIntl } from 'react-intl';

import { Stack } from '@onekeyhq/components';
import {
  ensureQRCodeUtilLoaded,
  getQRCodePlateBorderRadius,
} from '@onekeyhq/components/src/content/QRCode/QRCode.utils';
import { webFontFamily } from '@onekeyhq/components/src/utils/webFontFamily';
import {
  drawDotQRCodeOnCanvas,
  drawRoundedRect,
} from '@onekeyhq/kit/src/utils/qrCodeCanvas';
import { ONEKEY_LOGO_URL } from '@onekeyhq/kit/src/views/Receive/components/ReceiveShare/constants';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { REFERRAL_SHARE_CARD } from './constants';
import { REFERRAL_SHARE_NAMES } from './referralShareCopy';
import { truncateToWidth, wrapRuns } from './shareCardText';

import type { ITextRun } from './shareCardText';
import type {
  IReferralShareData,
  IReferralShareImageGeneratorRef,
} from './types';

// Render at 2x the logical size for a crisp image.
const CANVAS_SCALE = 2;
// The QRCode component's default plate padding and its white plate color.
const QR_PLATE_PADDING = 10;
const QR_PLATE_COLOR = '#FFFFFF';
const FOOTER_COLUMN_GAP = 16;
const FOOTER_TEXT_GAP = 4;
// Stands in for the highlighted rate while the headline is split into runs.
const RATE_MARKER = '\u0000rate\u0000';
const imageCache = new Map<string, HTMLImageElement>();

function loadImage(src: string): Promise<HTMLImageElement | null> {
  const cached = imageCache.get(src);
  if (cached) {
    return Promise.resolve(cached);
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

function toCanvasFont(size: number, weight: number) {
  return `${weight} ${size}px ${webFontFamily}`;
}

function drawRunLine(
  ctx: CanvasRenderingContext2D,
  line: ITextRun[],
  x: number,
  y: number,
) {
  let cursor = x;
  line.forEach((segment) => {
    ctx.fillStyle = segment.color;
    ctx.fillText(segment.text, cursor, y);
    cursor += ctx.measureText(segment.text).width;
  });
}

// Web and desktop twin of the native generator: paints the same dark card as
// ShareContentRenderer straight onto a canvas, like the receive share card.
export const ShareImageGenerator = memo(
  forwardRef<IReferralShareImageGeneratorRef, { data: IReferralShareData }>(
    ({ data }, ref) => {
      const intl = useIntl();
      const canvasRef = useRef<HTMLCanvasElement>(null);
      const lastResultRef = useRef<{ key: string; base64: string } | null>(
        null,
      );
      const { copy, inviteCode, inviteUrl, displayUrl } = data;
      const headline = intl.formatMessage(
        { id: copy.headlineId },
        { rate: RATE_MARKER },
      );
      const codeLabel = intl.formatMessage({
        id: ETranslations.referral_your_code,
      });
      const scanTitle = intl.formatMessage({
        id: ETranslations.referral_share_scan__desc,
      });
      const contentKey = [
        headline,
        copy.rate,
        codeLabel,
        scanTitle,
        inviteCode,
        inviteUrl,
        displayUrl,
      ].join('|');

      const paint = useCallback(async (): Promise<string> => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) {
          return '';
        }
        const card = REFERRAL_SHARE_CARD;
        const contentWidth = card.width - card.paddingX * 2;
        const qrPlateSize = card.footer.qrSize + QR_PLATE_PADDING;

        try {
          // The logo and the QR encoder load in parallel; both are cached
          // after the first card.
          const [logoImg] = await Promise.all([
            loadImage(ONEKEY_LOGO_URL),
            ensureQRCodeUtilLoaded(),
          ]);

          // Measuring pass: only the font matters to measureText.
          ctx.font = toCanvasFont(card.headline.size, 600);
          const headlineRuns: ITextRun[] = headline
            .split(RATE_MARKER)
            .flatMap((part, index) =>
              index > 0
                ? [
                    { text: copy.rate ?? '', color: card.accentColor },
                    { text: part, color: card.textColor },
                  ]
                : [{ text: part, color: card.textColor }],
            );
          const headlineLines = wrapRuns(ctx, headlineRuns, contentWidth);

          const footerTextWidth =
            contentWidth - FOOTER_COLUMN_GAP - qrPlateSize;
          ctx.font = toCanvasFont(card.footer.titleSize, 600);
          const titleLines = wrapRuns(
            ctx,
            [{ text: scanTitle, color: card.textColor }],
            footerTextWidth,
          );
          const footerTextHeight =
            titleLines.length * card.footer.titleLineHeight +
            FOOTER_TEXT_GAP +
            card.footer.urlLineHeight;
          const footerInnerHeight = Math.max(qrPlateSize, footerTextHeight);
          const footerHeight = footerInnerHeight + card.footer.paddingY * 2;

          const brandTop = card.paddingX;
          const headlineTop =
            brandTop + card.brand.logoSize + card.headline.gapAbove;
          const codeTop =
            headlineTop +
            headlineLines.length * card.headline.lineHeight +
            card.code.gapAbove;
          const footerTop =
            codeTop +
            card.code.labelLineHeight +
            card.code.lineHeight +
            card.footer.gapAbove;
          const totalHeight = footerTop + footerHeight;

          // Drawing pass.
          canvas.width = card.width * CANVAS_SCALE;
          canvas.height = totalHeight * CANVAS_SCALE;
          ctx.scale(CANVAS_SCALE, CANVAS_SCALE);
          ctx.fillStyle = card.backgroundColor;
          ctx.fillRect(0, 0, card.width, totalHeight);
          ctx.textAlign = 'left';
          // Each line is drawn at the middle of its line-height slot.
          ctx.textBaseline = 'middle';

          if (logoImg) {
            ctx.save();
            drawRoundedRect(
              ctx,
              card.paddingX,
              brandTop,
              card.brand.logoSize,
              card.brand.logoSize,
              card.brand.logoSize / 4,
            );
            ctx.clip();
            ctx.drawImage(
              logoImg,
              card.paddingX,
              brandTop,
              card.brand.logoSize,
              card.brand.logoSize,
            );
            ctx.restore();
          }
          ctx.font = toCanvasFont(card.brand.textSize, 600);
          ctx.fillStyle = card.textColor;
          ctx.fillText(
            REFERRAL_SHARE_NAMES.brand,
            card.paddingX + card.brand.logoSize + card.brand.gap,
            brandTop + card.brand.logoSize / 2,
          );

          ctx.font = toCanvasFont(card.headline.size, 600);
          headlineLines.forEach((line, index) => {
            drawRunLine(
              ctx,
              line,
              card.paddingX,
              headlineTop +
                index * card.headline.lineHeight +
                card.headline.lineHeight / 2,
            );
          });

          ctx.font = toCanvasFont(card.code.labelSize, 400);
          ctx.fillStyle = card.subduedTextColor;
          ctx.fillText(
            codeLabel,
            card.paddingX,
            codeTop + card.code.labelLineHeight / 2,
          );
          ctx.font = toCanvasFont(card.code.size, 600);
          ctx.fillStyle = card.textColor;
          ctx.fillText(
            truncateToWidth(ctx, inviteCode, contentWidth),
            card.paddingX,
            codeTop + card.code.labelLineHeight + card.code.lineHeight / 2,
          );

          ctx.fillStyle = card.footerBackgroundColor;
          ctx.fillRect(0, footerTop, card.width, footerHeight);
          const footerInnerTop = footerTop + card.footer.paddingY;
          // The text column and the QR plate are centered on each other.
          const textTop =
            footerInnerTop + (footerInnerHeight - footerTextHeight) / 2;
          ctx.font = toCanvasFont(card.footer.titleSize, 600);
          titleLines.forEach((line, index) => {
            drawRunLine(
              ctx,
              line,
              card.paddingX,
              textTop +
                index * card.footer.titleLineHeight +
                card.footer.titleLineHeight / 2,
            );
          });
          ctx.font = toCanvasFont(card.footer.urlSize, 400);
          ctx.fillStyle = card.subduedTextColor;
          ctx.fillText(
            truncateToWidth(ctx, displayUrl, footerTextWidth),
            card.paddingX,
            textTop +
              titleLines.length * card.footer.titleLineHeight +
              FOOTER_TEXT_GAP +
              card.footer.urlLineHeight / 2,
          );

          const plateX = card.width - card.paddingX - qrPlateSize;
          const plateY = footerInnerTop + (footerInnerHeight - qrPlateSize) / 2;
          ctx.fillStyle = QR_PLATE_COLOR;
          drawRoundedRect(
            ctx,
            plateX,
            plateY,
            qrPlateSize,
            qrPlateSize,
            getQRCodePlateBorderRadius(QR_PLATE_PADDING / 2),
          );
          ctx.fill();
          // A card nobody can scan is a failed image: a throw here skips the
          // cache, so the next Save tries again.
          await drawDotQRCodeOnCanvas(ctx, {
            value: inviteUrl,
            x: plateX + QR_PLATE_PADDING / 2,
            y: plateY + QR_PLATE_PADDING / 2,
            size: card.footer.qrSize,
            // The QRCode component's default level, so both cards match.
            ecl: 'H',
          });

          const base64 = canvas.toDataURL('image/png', 1.0);
          lastResultRef.current = { key: contentKey, base64 };
          return base64;
        } catch (error) {
          if (platformEnv.isDev) {
            console.error('Failed to generate referral share image:', error);
          }
          return '';
        }
      }, [
        codeLabel,
        contentKey,
        copy.rate,
        displayUrl,
        headline,
        inviteCode,
        inviteUrl,
        scanTitle,
      ]);

      // The preview and an early Save can ask at once; they share one paint
      // of the one canvas instead of clearing each other's drawing.
      const pendingRef = useRef<{
        key: string;
        promise: Promise<string>;
      } | null>(null);
      const generate = useCallback(async (): Promise<string> => {
        if (lastResultRef.current?.key === contentKey) {
          return lastResultRef.current.base64;
        }
        if (pendingRef.current?.key === contentKey) {
          return pendingRef.current.promise;
        }
        const promise = paint().finally(() => {
          if (pendingRef.current?.promise === promise) {
            pendingRef.current = null;
          }
        });
        pendingRef.current = { key: contentKey, promise };
        return promise;
      }, [contentKey, paint]);

      useImperativeHandle(ref, () => ({ generate }), [generate]);

      return (
        // Offscreen above and left of the origin, so it adds no scroll area.
        <Stack
          position="absolute"
          left={-9999}
          top={-9999}
          opacity={0}
          pointerEvents="none"
          zIndex={-1}
        >
          <canvas ref={canvasRef} />
        </Stack>
      );
    },
  ),
);

ShareImageGenerator.displayName = 'ShareImageGenerator';
