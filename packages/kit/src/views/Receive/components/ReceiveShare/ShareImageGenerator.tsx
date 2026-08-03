import {
  forwardRef,
  memo,
  useCallback,
  useImperativeHandle,
  useRef,
} from 'react';

import QRCodeUtil from 'qrcode';

import { Stack } from '@onekeyhq/components';
import { webFontFamily } from '@onekeyhq/components/src/utils/webFontFamily';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  ONEKEY_LOGO_URL,
  SHARE_CARD_CONFIG,
  groupAddress,
  splitGroupedAddress,
} from './constants';

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

type IStyledToken = { text: string; font: string; color: string };

function toWordTokens(
  text: string,
  font: string,
  color: string,
): IStyledToken[] {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => ({ text: word, font, color }));
}

// greedy word wrap over tokens that may carry different fonts/colors
function wrapStyledTokens(
  ctx: CanvasRenderingContext2D,
  tokens: IStyledToken[],
  maxWidth: number,
): IStyledToken[][] {
  const lines: IStyledToken[][] = [];
  let currentLine: IStyledToken[] = [];
  let currentWidth = 0;
  for (const token of tokens) {
    ctx.font = token.font;
    const wordWidth = ctx.measureText(token.text).width;
    const spaceWidth = currentLine.length ? ctx.measureText(' ').width : 0;
    if (
      currentLine.length &&
      currentWidth + spaceWidth + wordWidth > maxWidth
    ) {
      lines.push(currentLine);
      currentLine = [token];
      currentWidth = wordWidth;
    } else {
      currentLine.push(token);
      currentWidth += spaceWidth + wordWidth;
    }
  }
  if (currentLine.length) {
    lines.push(currentLine);
  }
  return lines;
}

function drawStyledLineCentered(
  ctx: CanvasRenderingContext2D,
  line: IStyledToken[],
  centerX: number,
  y: number,
) {
  let totalWidth = 0;
  line.forEach((token, index) => {
    ctx.font = token.font;
    if (index) totalWidth += ctx.measureText(' ').width;
    totalWidth += ctx.measureText(token.text).width;
  });

  ctx.textAlign = 'left';
  let x = centerX - totalWidth / 2;
  line.forEach((token, index) => {
    ctx.font = token.font;
    if (index) x += ctx.measureText(' ').width;
    ctx.fillStyle = token.color;
    ctx.fillText(token.text, x, y);
    x += ctx.measureText(token.text).width;
  });
}

export const ShareImageGenerator = memo(
  forwardRef<IReceiveShareImageGeneratorRef, IShareImageGeneratorProps>(
    ({ data }, ref) => {
      const canvasRef = useRef<HTMLCanvasElement>(null);
      // cache the rendered result so repeat generate() calls for the same
      // content skip the QR encode and canvas repaint (parity with native)
      const lastResultRef = useRef<{ key: string; base64: string } | null>(
        null,
      );
      const {
        title,
        subtitle,
        networkName,
        address,
        tokenLogoURI,
        networkLogoURI,
      } = data;

      const contentKey = [
        title,
        subtitle,
        networkName,
        address,
        tokenLogoURI,
        networkLogoURI,
      ].join('|');

      const generate = useCallback(async (): Promise<string> => {
        if (lastResultRef.current?.key === contentKey) {
          return lastResultRef.current.base64;
        }
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
          const [tokenLogoImg, networkLogoImg, onekeyLogoImg] =
            await Promise.all([
              tokenLogoURI ? loadImage(tokenLogoURI) : Promise.resolve(null),
              networkLogoURI
                ? loadImage(networkLogoURI)
                : Promise.resolve(null),
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

          const subtitleFont = toCanvasFont(
            subtitleStyle.size,
            subtitleStyle.weight,
          );
          const subtitleEmphasizedFont = toCanvasFont(
            subtitleStyle.size,
            subtitleStyle.emphasizedWeight,
          );
          const networkNameIndex = networkName
            ? subtitle.indexOf(networkName)
            : -1;
          const subtitleTokens =
            networkName && networkNameIndex >= 0
              ? [
                  ...toWordTokens(
                    subtitle.slice(0, networkNameIndex),
                    subtitleFont,
                    subtitleStyle.color,
                  ),
                  ...toWordTokens(
                    networkName,
                    subtitleEmphasizedFont,
                    subtitleStyle.emphasizedColor,
                  ),
                  ...toWordTokens(
                    subtitle.slice(networkNameIndex + networkName.length),
                    subtitleFont,
                    subtitleStyle.color,
                  ),
                ]
              : toWordTokens(subtitle, subtitleFont, subtitleStyle.color);
          const subtitleLines = wrapStyledTokens(
            ctx,
            subtitleTokens,
            content.width,
          );
          const subtitleHeight =
            subtitleLines.length * subtitleStyle.lineHeight;

          ctx.font = toCanvasFont(
            addressText.size,
            addressText.weight,
            addressText.monoFontFamily,
          );
          const addressLines = wrapText(ctx, groupedAddress, addressTextWidth);
          const addressTextHeight =
            addressLines.length * addressText.lineHeight;

          const qrCellHeight = qr.cellPaddingY * 2 + qr.size;
          const addressCellHeight =
            addressCell.paddingY * 2 + addressTextHeight;
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

          const subtitleY =
            content.paddingTop + titleHeight + subtitleStyle.gapAboveTitle;
          subtitleLines.forEach((line, index) => {
            drawStyledLineCentered(
              ctx,
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

              // network corner badge at the bottom-right of the token logo
              if (networkLogoImg) {
                const badgeTotal =
                  qr.networkBadgeIconSize + qr.networkBadgePadding * 2;
                const badgeCenterX =
                  centerX + qr.logoPlateSize / 2 - badgeTotal / 2;
                const badgeCenterY =
                  centerY + qr.logoPlateSize / 2 - badgeTotal / 2;
                ctx.fillStyle = '#FFFFFF';
                ctx.beginPath();
                ctx.arc(
                  badgeCenterX,
                  badgeCenterY,
                  badgeTotal / 2,
                  0,
                  Math.PI * 2,
                );
                ctx.fill();

                ctx.save();
                ctx.beginPath();
                ctx.arc(
                  badgeCenterX,
                  badgeCenterY,
                  qr.networkBadgeIconSize / 2,
                  0,
                  Math.PI * 2,
                );
                ctx.clip();
                ctx.drawImage(
                  networkLogoImg,
                  badgeCenterX - qr.networkBadgeIconSize / 2,
                  badgeCenterY - qr.networkBadgeIconSize / 2,
                  qr.networkBadgeIconSize,
                  qr.networkBadgeIconSize,
                );
                ctx.restore();
              }
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

          ctx.font = toCanvasFont(
            addressText.size,
            addressText.weight,
            addressText.monoFontFamily,
          );
          ctx.textAlign = 'left';
          // middle baseline centers each line within its line-height slot so the
          // visual padding stays symmetric above and below the text block
          ctx.textBaseline = 'middle';
          const addressParts = splitGroupedAddress(address);
          const addressRuns = [
            { text: addressParts.leading, color: addressText.highlightColor },
            { text: addressParts.middle, color: addressText.color },
            { text: addressParts.trailing, color: addressText.highlightColor },
          ].filter((run) => run.text);
          // wrapped lines are exact substrings of the grouped address separated
          // by single spaces, so global positions map 1:1 onto run boundaries
          let linePos = 0;
          addressLines.forEach((line, index) => {
            const lineStart = linePos;
            const lineEnd = lineStart + line.length;
            const lineY =
              addressCellY +
              addressCell.paddingY +
              index * addressText.lineHeight +
              addressText.lineHeight / 2;
            let x = cellX + addressCell.paddingX;
            let runStart = 0;
            for (const run of addressRuns) {
              const runEnd = runStart + run.text.length;
              const overlapStart = Math.max(runStart, lineStart);
              const overlapEnd = Math.min(runEnd, lineEnd);
              if (overlapEnd > overlapStart) {
                const piece = groupedAddress.slice(overlapStart, overlapEnd);
                ctx.fillStyle = run.color;
                ctx.fillText(piece, x, lineY);
                x += ctx.measureText(piece).width;
              }
              runStart = runEnd;
            }
            linePos = lineEnd + 1;
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

          const base64 = canvas.toDataURL('image/png', 1.0);
          lastResultRef.current = { key: contentKey, base64 };
          return base64;
        } catch (error) {
          if (platformEnv.isDev) {
            console.error('Failed to generate image:', error);
          }
          return '';
        }
      }, [
        contentKey,
        title,
        subtitle,
        networkName,
        address,
        tokenLogoURI,
        networkLogoURI,
      ]);

      useImperativeHandle(ref, () => ({ generate }));

      return (
        // top must also be offscreen: an absolute box hanging below the fold
        // (top: 0 + tall canvas) extends the scrollable overflow area of the
        // Page ScrollView, adding phantom scroll distance (OK-58185). Overflow
        // above/left of the origin is unreachable and adds none.
        <Stack
          position="absolute"
          left={-9999}
          top={-9999}
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
    },
  ),
);

ShareImageGenerator.displayName = 'ShareImageGenerator';
