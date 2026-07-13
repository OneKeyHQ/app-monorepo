import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';

import QRCodeUtil from 'qrcode';

import { Stack } from '@onekeyhq/components';
import { webFontFamily } from '@onekeyhq/components/src/utils/webFontFamily';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  IRookieShareData,
  IRookieShareImageGeneratorRef,
} from '@onekeyhq/shared/types/rookieGuide';

import {
  BACKGROUND_GRADIENT_COLORS,
  ONEKEY_LOGO_URL,
  getCanvasConfig,
  resolveFooterCtaText,
} from './constants';

import type { IRookieShareLocaleText } from './constants';

interface IShareImageGeneratorProps {
  data: IRookieShareData;
  localeText: IRookieShareLocaleText;
}

const imageCache = new Map<string, HTMLImageElement>();

function toCanvasFont(
  size: number,
  weight: string | number = 500,
  family = webFontFamily,
): string {
  return `${weight} ${size}px ${family}`;
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

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(x, y, width, height, radius);
  } else {
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let currentLine = '';
  const fitsLine = (line: string): boolean =>
    ctx.measureText(line).width <= maxWidth;

  const breakLongWord = (word: string): string[] => {
    const brokenLines: string[] = [];
    let line = '';
    for (const char of Array.from(word)) {
      const nextLine = `${line}${char}`;
      if (ctx.measureText(nextLine).width > maxWidth && line) {
        brokenLines.push(line);
        line = char;
      } else {
        line = nextLine;
      }
    }
    if (line) {
      brokenLines.push(line);
    }
    return brokenLines;
  };

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (fitsLine(testLine)) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = '';
      }

      if (fitsLine(word)) {
        currentLine = word;
      } else {
        const brokenWordLines = breakLongWord(word);
        lines.push(...brokenWordLines.slice(0, -1));
        currentLine = brokenWordLines[brokenWordLines.length - 1] || '';
      }
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

// ctx.letterSpacing is a newer canvas API (Chrome/FF/Safari 16.4+); older
// engines silently ignore it, which is fine here since the bold-weight code
// is still legible without the extra tracking.
function setLetterSpacing(
  ctx: CanvasRenderingContext2D,
  spacing: number,
): void {
  const anyCtx = ctx as CanvasRenderingContext2D & {
    letterSpacing?: string;
  };
  if ('letterSpacing' in ctx) {
    anyCtx.letterSpacing = `${spacing}px`;
  }
}

const CANVAS_SIZE = 640;
const CANVAS_CONFIG = getCanvasConfig(CANVAS_SIZE);

export const ShareImageGenerator = forwardRef<
  IRookieShareImageGeneratorRef,
  IShareImageGeneratorProps
>(({ data, localeText }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { imageUrl, title, subtitle, footerText, referralCode, referralUrl } =
    data;

  const generate = useCallback(async (): Promise<string> => {
    const canvas = canvasRef.current;
    if (!canvas) return '';

    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    const {
      size,
      card,
      badge,
      fonts,
      footer,
      logo,
      qrCode,
      referralPill,
      spacing,
    } = CANVAS_CONFIG;
    canvas.width = size;
    canvas.height = size;

    try {
      const gradient = ctx.createLinearGradient(0, 0, size, size);
      BACKGROUND_GRADIENT_COLORS.forEach((color, index) => {
        gradient.addColorStop(
          index / (BACKGROUND_GRADIENT_COLORS.length - 1),
          color,
        );
      });
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);

      const [badgeImg, logoImg] = await Promise.all([
        loadImage(imageUrl),
        loadImage(ONEKEY_LOGO_URL),
      ]);

      ctx.font = toCanvasFont(fonts.title.size, fonts.title.weight);
      const titleLines = wrapText(ctx, title, fonts.title.maxWidth);
      const titleHeight =
        titleLines.length * fonts.title.size * fonts.title.lineHeight;

      let subtitleHeight = 0;
      let subtitleLines: string[] = [];
      if (subtitle) {
        ctx.font = toCanvasFont(fonts.subtitle.size, fonts.subtitle.weight);
        subtitleLines = wrapText(ctx, subtitle, fonts.subtitle.maxWidth);
        subtitleHeight =
          subtitleLines.length *
          fonts.subtitle.size *
          fonts.subtitle.lineHeight;
      }

      const cardContentHeight =
        badge.height +
        spacing.cardBadgeTitleGap +
        titleHeight +
        (subtitle ? spacing.cardTitleSubtitleGap + subtitleHeight : 0);
      const cardHeight = card.padding * 2 + cardContentHeight;

      const availableHeight = footer.y;
      const cardY = (availableHeight - cardHeight) / 2;

      ctx.shadowColor = card.shadowColor;
      ctx.shadowBlur = card.shadowBlur;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = card.shadowOffsetY;

      ctx.fillStyle = card.backgroundColor;
      drawRoundedRect(
        ctx,
        card.x,
        cardY,
        card.width,
        cardHeight,
        card.borderRadius,
      );
      ctx.fill();

      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      if (badgeImg) {
        const badgeX = card.x + (card.width - badge.width) / 2;
        const badgeY = cardY + card.padding;
        ctx.drawImage(badgeImg, badgeX, badgeY, badge.width, badge.height);
      }

      ctx.fillStyle = fonts.title.color;
      ctx.font = toCanvasFont(fonts.title.size, fonts.title.weight);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const titleY =
        cardY + card.padding + badge.height + spacing.cardBadgeTitleGap;
      titleLines.forEach((line, index) => {
        ctx.fillText(
          line,
          card.x + card.width / 2,
          titleY + index * fonts.title.size * fonts.title.lineHeight,
        );
      });

      if (subtitle && subtitleLines.length > 0) {
        ctx.fillStyle = fonts.subtitle.color;
        ctx.font = toCanvasFont(fonts.subtitle.size, fonts.subtitle.weight);
        const subtitleY = titleY + titleHeight + spacing.cardTitleSubtitleGap;
        subtitleLines.forEach((line, index) => {
          ctx.fillText(
            line,
            card.x + card.width / 2,
            subtitleY + index * fonts.subtitle.size * fonts.subtitle.lineHeight,
          );
        });
      }

      ctx.fillStyle = footer.backgroundColor;
      ctx.fillRect(0, footer.y, size, footer.height);
      ctx.fillStyle = footer.borderTopColor;
      ctx.fillRect(0, footer.y, size, footer.borderTopWidth);

      if (logoImg) {
        const logoX = footer.paddingX;
        const logoY =
          footer.y + (footer.height - logo.size) / 2 + logo.footerOffsetY;
        ctx.drawImage(logoImg, logoX, logoY, logo.size, logo.size);
      }

      const textX = footer.paddingX + logo.size + spacing.footerLogoTextGap;
      const line1Text = resolveFooterCtaText(
        referralCode,
        footerText,
        localeText,
      );

      const line1Height = fonts.footerCta.size * fonts.footerCta.lineHeight;
      const codeTextHeight =
        fonts.referralCode.size * fonts.referralCode.lineHeight;
      const pillHeight = codeTextHeight + referralPill.paddingY * 2;
      const footerSubtitleHeight =
        fonts.referralLabel.size * fonts.referralLabel.lineHeight;

      const line2Height = referralCode ? pillHeight : footerSubtitleHeight;
      const blockHeight = line1Height + spacing.footerTextLineGap + line2Height;
      const blockY = footer.y + (footer.height - blockHeight) / 2;

      ctx.fillStyle = fonts.footerCta.color;
      ctx.font = toCanvasFont(fonts.footerCta.size, fonts.footerCta.weight);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(line1Text, textX, blockY);

      const line2Y = blockY + line1Height + spacing.footerTextLineGap;

      if (referralCode) {
        const line2CenterY = line2Y + pillHeight / 2;

        ctx.fillStyle = fonts.referralLabel.color;
        ctx.font = toCanvasFont(
          fonts.referralLabel.size,
          fonts.referralLabel.weight,
        );
        ctx.textBaseline = 'middle';
        ctx.fillText(localeText.referralLabel, textX, line2CenterY);
        const labelWidth = ctx.measureText(localeText.referralLabel).width;

        const pillX = textX + labelWidth + spacing.footerReferralInlineGap;
        ctx.font = toCanvasFont(
          fonts.referralCode.size,
          fonts.referralCode.weight,
          fonts.referralCode.monoFontFamily,
        );
        setLetterSpacing(ctx, fonts.referralCode.letterSpacing);
        const codeWidth = ctx.measureText(referralCode).width;
        const pillWidth = codeWidth + referralPill.paddingX * 2;

        ctx.fillStyle = referralPill.backgroundColor;
        drawRoundedRect(
          ctx,
          pillX,
          line2Y,
          pillWidth,
          pillHeight,
          referralPill.borderRadius,
        );
        ctx.fill();

        ctx.fillStyle = fonts.referralCode.color;
        ctx.fillText(referralCode, pillX + referralPill.paddingX, line2CenterY);
        setLetterSpacing(ctx, 0);
      } else {
        ctx.fillStyle = fonts.referralLabel.color;
        ctx.font = toCanvasFont(
          fonts.referralLabel.size,
          fonts.referralLabel.weight,
        );
        ctx.textBaseline = 'top';
        ctx.fillText(localeText.downloadSubtitle, textX, line2Y);
      }

      if (referralUrl) {
        const captionHeight = fonts.qrCaption.size * fonts.qrCaption.lineHeight;
        const qrBlockHeight =
          qrCode.size + spacing.qrCaptionGap + captionHeight;
        const qrCodeY = footer.y + (footer.height - qrBlockHeight) / 2;
        const qrCodeX = size - footer.paddingX - qrCode.size;

        try {
          const qrCodeDataUrl = await QRCodeUtil.toDataURL(referralUrl, {
            width: qrCode.size,
            margin: 0,
            color: {
              dark: qrCode.color,
              light: '#FFFFFF',
            },
          });
          const qrCodeImg = await loadImage(qrCodeDataUrl);
          if (qrCodeImg) {
            ctx.drawImage(
              qrCodeImg,
              qrCodeX,
              qrCodeY,
              qrCode.size,
              qrCode.size,
            );
          }
        } catch (error) {
          if (platformEnv.isDev) {
            console.error('Failed to generate QR code:', error);
          }
        }

        ctx.fillStyle = fonts.qrCaption.color;
        ctx.font = toCanvasFont(fonts.qrCaption.size, fonts.qrCaption.weight);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        setLetterSpacing(ctx, fonts.qrCaption.letterSpacing);
        ctx.fillText(
          localeText.qrCaption,
          qrCodeX + qrCode.size / 2,
          qrCodeY + qrCode.size + spacing.qrCaptionGap,
        );
        setLetterSpacing(ctx, 0);
      }

      return canvas.toDataURL('image/png', 1.0);
    } catch (error) {
      if (platformEnv.isDev) {
        console.error('Failed to generate image:', error);
      }
      return '';
    }
  }, [
    imageUrl,
    title,
    subtitle,
    footerText,
    referralCode,
    referralUrl,
    localeText,
  ]);

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
      <canvas ref={canvasRef} width={CANVAS_SIZE} height={CANVAS_SIZE} />
    </Stack>
  );
});

ShareImageGenerator.displayName = 'ShareImageGenerator';
