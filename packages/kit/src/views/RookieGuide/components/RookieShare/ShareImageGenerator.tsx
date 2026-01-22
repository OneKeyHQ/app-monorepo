import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';

import QRCodeUtil from 'qrcode';

import { Stack } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  IRookieShareData,
  IRookieShareImageGeneratorRef,
} from '@onekeyhq/shared/types/rookieGuide';

import {
  BACKGROUND_GRADIENT_COLORS,
  DEFAULT_FOOTER_TEXT,
  DEFAULT_REFERRAL_LABEL,
  ONEKEY_LOGO_URL,
  getCanvasConfig,
} from './constants';

interface IShareImageGeneratorProps {
  data: IRookieShareData;
}

const imageCache = new Map<string, HTMLImageElement>();

function toCanvasFont(
  size: number,
  weight: string | number = 500,
  family = 'Poppins, system-ui, -apple-system, sans-serif',
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

// Helper function to draw rounded rectangle
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
    // Fallback for older browsers
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

// Helper function to wrap text
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

const CANVAS_SIZE = 640;
const CANVAS_CONFIG = getCanvasConfig(CANVAS_SIZE);

export const ShareImageGenerator = forwardRef<
  IRookieShareImageGeneratorRef,
  IShareImageGeneratorProps
>(({ data }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const generate = useCallback(async (): Promise<string> => {
    const canvas = canvasRef.current;
    if (!canvas) return '';

    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    const { size, card, badge, fonts, footer, logo, qrCode, spacing } =
      CANVAS_CONFIG;
    canvas.width = size;
    canvas.height = size;

    const { imageUrl, title, subtitle, footerText, referralCode, referralUrl } =
      data;

    try {
      // 1. Draw background gradient (fallback for wave pattern)
      const gradient = ctx.createLinearGradient(0, 0, size, size);
      BACKGROUND_GRADIENT_COLORS.forEach((color, index) => {
        gradient.addColorStop(
          index / (BACKGROUND_GRADIENT_COLORS.length - 1),
          color,
        );
      });
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);

      // Load images in parallel
      const [badgeImg, logoImg] = await Promise.all([
        loadImage(imageUrl),
        loadImage(ONEKEY_LOGO_URL),
      ]);

      // 2. Calculate card height dynamically
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
        spacing.cardContentGap +
        titleHeight +
        (subtitle ? spacing.cardContentGap + subtitleHeight : 0);
      const cardHeight = card.padding * 2 + cardContentHeight;

      // Center card vertically (above footer)
      const availableHeight = footer.y;
      const cardY = (availableHeight - cardHeight) / 2;

      // 3. Draw card shadow
      ctx.shadowColor = card.shadowColor;
      ctx.shadowBlur = card.shadowBlur;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = card.shadowOffsetY;

      // 4. Draw card background
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

      // Reset shadow
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      // 5. Draw badge image
      if (badgeImg) {
        const badgeX = card.x + (card.width - badge.width) / 2;
        const badgeY = cardY + card.padding;
        ctx.drawImage(badgeImg, badgeX, badgeY, badge.width, badge.height);
      }

      // 6. Draw title
      ctx.fillStyle = fonts.title.color;
      ctx.font = toCanvasFont(fonts.title.size, fonts.title.weight);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const titleY =
        cardY + card.padding + badge.height + spacing.cardContentGap;
      titleLines.forEach((line, index) => {
        ctx.fillText(
          line,
          card.x + card.width / 2,
          titleY + index * fonts.title.size * fonts.title.lineHeight,
        );
      });

      // 7. Draw subtitle
      if (subtitle && subtitleLines.length > 0) {
        ctx.fillStyle = fonts.subtitle.color;
        ctx.font = toCanvasFont(fonts.subtitle.size, fonts.subtitle.weight);
        const subtitleY = titleY + titleHeight + spacing.cardContentGap;
        subtitleLines.forEach((line, index) => {
          ctx.fillText(
            line,
            card.x + card.width / 2,
            subtitleY + index * fonts.subtitle.size * fonts.subtitle.lineHeight,
          );
        });
      }

      // 8. Draw footer background
      ctx.fillStyle = footer.backgroundColor;
      ctx.fillRect(0, footer.y, size, footer.height);

      // 9. Draw logo
      if (logoImg) {
        const logoX = footer.paddingX;
        const logoY = footer.y + (footer.height - logo.size) / 2;
        ctx.drawImage(logoImg, logoX, logoY, logo.size, logo.size);
      }

      // 10. Draw footer text
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const textX = footer.paddingX + logo.size + spacing.footerLogoTextGap;
      const footerCenterY = footer.y + footer.height / 2;

      // Footer main text
      ctx.fillStyle = fonts.footerText.color;
      ctx.font = toCanvasFont(fonts.footerText.size, fonts.footerText.weight);
      ctx.fillText(
        footerText || DEFAULT_FOOTER_TEXT,
        textX,
        footerCenterY - spacing.footerTextLineGap,
      );

      // Referral code text
      ctx.fillStyle = fonts.referralText.color;
      ctx.font = toCanvasFont(
        fonts.referralText.size,
        fonts.referralText.weight,
      );
      const referralLabel = referralCode
        ? `${DEFAULT_REFERRAL_LABEL} ${referralCode}`
        : DEFAULT_REFERRAL_LABEL;
      ctx.fillText(
        referralLabel,
        textX,
        footerCenterY + spacing.footerTextLineGap,
      );

      // 11. Draw QR code
      if (referralUrl) {
        const qrCodeX = size - footer.paddingX - qrCode.size;
        const qrCodeY = footer.y + (footer.height - qrCode.size) / 2;

        try {
          const qrCodeDataUrl = await QRCodeUtil.toDataURL(referralUrl, {
            width: qrCode.size,
            margin: 0,
            color: {
              dark: '#000000',
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
      }

      return canvas.toDataURL('image/png', 1.0);
    } catch (error) {
      if (platformEnv.isDev) {
        console.error('Failed to generate image:', error);
      }
      return '';
    }
  }, [data]);

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
