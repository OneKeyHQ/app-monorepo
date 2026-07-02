import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';

import QRCodeUtil from 'qrcode';

import { Stack } from '@onekeyhq/components';
import { webFontFamily } from '@onekeyhq/components/src/utils/webFontFamily';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { ONEKEY_LOGO_URL, SHARE_CARD_CONFIG, groupAddress } from './constants';

import type {
  IReceiveShareData,
  IReceiveShareImageGeneratorRef,
} from './types';

interface IShareImageGeneratorProps {
  data: IReceiveShareData;
}

const imageCache = new Map<string, HTMLImageElement>();

// render at 2x logical size for crisp output
const CANVAS_SCALE = 2;

function toCanvasFont(
  size: number,
  weight: string | number = 500,
  family = webFontFamily,
): string {
  return `${weight} ${size}px ${family}`;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  // data URLs (per-address QR images) are unique and instant to decode:
  // caching them would grow the module-level cache unboundedly
  const isDataUrl = src.startsWith('data:');
  if (!isDataUrl && imageCache.has(src)) {
    return Promise.resolve(imageCache.get(src) ?? null);
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (!isDataUrl) {
        imageCache.set(src, img);
      }
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

export const ShareImageGenerator = forwardRef<
  IReceiveShareImageGeneratorRef,
  IShareImageGeneratorProps
>(({ data }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { title, subtitle, address, tokenLogoURI } = data;

  const generate = useCallback(async (): Promise<string> => {
    const canvas = canvasRef.current;
    if (!canvas) return '';

    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    const {
      width,
      minHeight,
      backgroundColor,
      content,
      title: titleStyle,
      subtitle: subtitleStyle,
      wrapper,
      cell,
      qr,
      addressCell,
      addressText,
      footer,
    } = SHARE_CARD_CONFIG;

    try {
      const [tokenLogoImg, onekeyLogoImg] = await Promise.all([
        tokenLogoURI ? loadImage(tokenLogoURI) : Promise.resolve(null),
        loadImage(ONEKEY_LOGO_URL),
      ]);

      const groupedAddress = groupAddress(address);
      const cellWidth = content.width - wrapper.padding * 2;
      const addressTextWidth = cellWidth - addressCell.paddingX * 2;

      // measuring pass: canvas resize resets ctx state, so measure first,
      // then resize + scale + draw
      canvas.width = width * CANVAS_SCALE;
      ctx.font = toCanvasFont(titleStyle.size, titleStyle.weight);
      const titleLines = wrapText(ctx, title, content.width);
      const titleHeight = titleLines.length * titleStyle.lineHeight;

      ctx.font = toCanvasFont(subtitleStyle.size, subtitleStyle.weight);
      const subtitleLines = wrapText(ctx, subtitle, content.width);
      const subtitleHeight = subtitleLines.length * subtitleStyle.lineHeight;

      ctx.font = toCanvasFont(
        addressText.size,
        addressText.weight,
        addressText.monoFontFamily,
      );
      const addressLines = wrapText(ctx, groupedAddress, addressTextWidth);
      const addressTextHeight = addressLines.length * addressText.lineHeight;

      const qrCellHeight = qr.cellPaddingY * 2 + qr.size;
      const addressCellHeight = addressCell.paddingY * 2 + addressTextHeight;
      const wrapperHeight =
        wrapper.padding * 2 +
        qrCellHeight +
        wrapper.cellGap +
        addressCellHeight;

      const wrapperY =
        content.paddingTop +
        titleHeight +
        subtitleStyle.gapAboveTitle +
        subtitleHeight +
        wrapper.gapAboveSubtitle;
      const contentBottom = wrapperY + wrapperHeight;
      const totalHeight = Math.max(
        minHeight,
        contentBottom + wrapper.gapAboveSubtitle + footer.height,
      );

      // drawing pass
      canvas.width = width * CANVAS_SCALE;
      canvas.height = totalHeight * CANVAS_SCALE;
      ctx.scale(CANVAS_SCALE, CANVAS_SCALE);

      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, width, totalHeight);

      ctx.fillStyle = titleStyle.color;
      ctx.font = toCanvasFont(titleStyle.size, titleStyle.weight);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      titleLines.forEach((line, index) => {
        ctx.fillText(
          line,
          width / 2,
          content.paddingTop + index * titleStyle.lineHeight,
        );
      });

      ctx.fillStyle = subtitleStyle.color;
      ctx.font = toCanvasFont(subtitleStyle.size, subtitleStyle.weight);
      const subtitleY =
        content.paddingTop + titleHeight + subtitleStyle.gapAboveTitle;
      subtitleLines.forEach((line, index) => {
        ctx.fillText(
          line,
          width / 2,
          subtitleY + index * subtitleStyle.lineHeight,
        );
      });

      ctx.fillStyle = wrapper.backgroundColor;
      drawRoundedRect(
        ctx,
        content.paddingX,
        wrapperY,
        content.width,
        wrapperHeight,
        wrapper.borderRadius,
      );
      ctx.fill();

      const cellX = content.paddingX + wrapper.padding;
      const qrCellY = wrapperY + wrapper.padding;

      ctx.fillStyle = cell.backgroundColor;
      ctx.strokeStyle = cell.borderColor;
      ctx.lineWidth = 1;
      drawRoundedRect(
        ctx,
        cellX,
        qrCellY,
        cellWidth,
        qrCellHeight,
        cell.borderRadius,
      );
      ctx.fill();
      ctx.stroke();

      const qrX = cellX + (cellWidth - qr.size) / 2;
      const qrY = qrCellY + qr.cellPaddingY;
      try {
        const qrCodeDataUrl = await QRCodeUtil.toDataURL(address, {
          width: qr.size * CANVAS_SCALE,
          margin: 0,
          // high error correction: the center plate occludes part of the code
          errorCorrectionLevel: 'H',
          color: {
            dark: '#000000',
            light: '#FFFFFF',
          },
        });
        const qrCodeImg = await loadImage(qrCodeDataUrl);
        if (qrCodeImg) {
          ctx.drawImage(qrCodeImg, qrX, qrY, qr.size, qr.size);
        }

        // center token logo on a white plate; skip entirely if the logo
        // failed to load (CORS/404) so the QR stays clean and scannable
        if (tokenLogoImg) {
          const centerX = qrX + qr.size / 2;
          const centerY = qrY + qr.size / 2;
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(centerX, centerY, qr.logoPlateSize / 2, 0, Math.PI * 2);
          ctx.fill();

          ctx.save();
          ctx.beginPath();
          ctx.arc(centerX, centerY, qr.logoSize / 2, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(
            tokenLogoImg,
            centerX - qr.logoSize / 2,
            centerY - qr.logoSize / 2,
            qr.logoSize,
            qr.logoSize,
          );
          ctx.restore();
        }
      } catch (error) {
        if (platformEnv.isDev) {
          console.error('Failed to generate QR code:', error);
        }
      }

      const addressCellY = qrCellY + qrCellHeight + wrapper.cellGap;
      ctx.fillStyle = cell.backgroundColor;
      ctx.strokeStyle = cell.borderColor;
      drawRoundedRect(
        ctx,
        cellX,
        addressCellY,
        cellWidth,
        addressCellHeight,
        cell.borderRadius,
      );
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = addressText.color;
      ctx.font = toCanvasFont(
        addressText.size,
        addressText.weight,
        addressText.monoFontFamily,
      );
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      addressLines.forEach((line, index) => {
        ctx.fillText(
          line,
          cellX + addressCell.paddingX,
          addressCellY + addressCell.paddingY + index * addressText.lineHeight,
        );
      });

      const footerContentY = totalHeight - footer.height + 4;
      if (onekeyLogoImg) {
        ctx.drawImage(
          onekeyLogoImg,
          footer.paddingX,
          footerContentY,
          footer.logoSize,
          footer.logoSize,
        );
      }
      ctx.fillStyle = footer.logoTextColor;
      ctx.font = toCanvasFont(footer.logoTextSize, footer.logoTextWeight);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        footer.logoText,
        footer.paddingX + footer.logoSize + footer.logoTextGap,
        footerContentY + footer.logoSize / 2,
      );

      return canvas.toDataURL('image/png', 1.0);
    } catch (error) {
      if (platformEnv.isDev) {
        console.error('Failed to generate image:', error);
      }
      return '';
    }
  }, [title, subtitle, address, tokenLogoURI]);

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
        width={SHARE_CARD_CONFIG.width * CANVAS_SCALE}
        height={SHARE_CARD_CONFIG.minHeight * CANVAS_SCALE}
      />
    </Stack>
  );
});

ShareImageGenerator.displayName = 'ShareImageGenerator';
