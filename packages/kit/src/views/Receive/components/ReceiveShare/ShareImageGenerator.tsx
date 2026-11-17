import {
  forwardRef,
  memo,
  useCallback,
  useImperativeHandle,
  useRef,
} from 'react';

import { Stack } from '@onekeyhq/components';
import { webFontFamily } from '@onekeyhq/components/src/utils/webFontFamily';
import {
  drawDotQRCodeOnCanvas,
  drawQRCodeBrandMark,
  drawRoundedRect,
} from '@onekeyhq/kit/src/utils/qrCodeCanvas';
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

type ITitleBlock = {
  kind: 'text' | 'symbol';
  text: string;
  width: number;
};

// The title as up to two blocks, the words and the token logo with the
// symbol, broken into lines. The blocks only part at a line break, like the
// on-screen title (see ReceiveTitleBlocks). Returns null when the logo +
// symbol block cannot fit a line: the caller then draws the plain sentence,
// which wraps anywhere and so keeps all of its text.
function layoutTitleWithLogo(
  ctx: CanvasRenderingContext2D,
  {
    before,
    symbol,
    after,
    gap,
    maxWidth,
  }: {
    before: string;
    symbol: string;
    after: string;
    gap: number;
    maxWidth: number;
  },
): ITitleBlock[][] | null {
  const { iconSize, iconGap } = SHARE_CARD_CONFIG.title;
  const symbolWidth = iconSize + iconGap + ctx.measureText(symbol).width;
  if (symbolWidth > maxWidth) {
    return null;
  }
  const toTextBlock = (text: string): ITitleBlock[] =>
    text ? [{ kind: 'text', text, width: ctx.measureText(text).width }] : [];
  const blocks: ITitleBlock[] = [
    ...toTextBlock(before),
    { kind: 'symbol', text: symbol, width: symbolWidth },
    ...toTextBlock(after),
  ];

  const lines: ITitleBlock[][] = [];
  let line: ITitleBlock[] = [];
  let lineWidth = 0;
  for (const block of blocks) {
    const nextWidth = line.length ? lineWidth + gap + block.width : block.width;
    if (line.length && nextWidth > maxWidth) {
      lines.push(line);
      line = [block];
      lineWidth = block.width;
    } else {
      line.push(block);
      lineWidth = nextWidth;
    }
  }
  lines.push(line);
  return lines;
}

// Expects the title font, fill color and a top text baseline to be set.
function drawTitleLineWithLogo(
  ctx: CanvasRenderingContext2D,
  line: ITitleBlock[],
  logo: HTMLImageElement,
  { centerX, y, gap }: { centerX: number; y: number; gap: number },
) {
  const { iconSize, iconGap, size } = SHARE_CARD_CONFIG.title;
  const totalWidth = line.reduce(
    (sum, block, index) => sum + block.width + (index ? gap : 0),
    0,
  );

  ctx.textAlign = 'left';
  let x = centerX - totalWidth / 2;
  line.forEach((block, index) => {
    if (index) x += gap;
    if (block.kind === 'symbol') {
      // the text hangs from the top of its em box; center the logo on it
      const iconY = y + (size - iconSize) / 2;
      ctx.save();
      ctx.beginPath();
      ctx.arc(
        x + iconSize / 2,
        iconY + iconSize / 2,
        iconSize / 2,
        0,
        Math.PI * 2,
      );
      ctx.clip();
      ctx.drawImage(logo, x, iconY, iconSize, iconSize);
      ctx.restore();
      ctx.fillText(block.text, x + iconSize + iconGap, y);
    } else {
      ctx.fillText(block.text, x, y);
    }
    x += block.width;
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
      const { title, titleLogo, subtitle, networkName, address } = data;

      const contentKey = [
        title,
        subtitle,
        networkName,
        address,
        titleLogo?.uri,
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
          // a title logo that fails to load leaves the plain title; the
          // OneKey logo is only the footer's, the mark in the code is drawn
          const [titleLogoImg, onekeyLogoImg] = await Promise.all([
            titleLogo ? loadImage(titleLogo.uri) : Promise.resolve(null),
            loadImage(ONEKEY_LOGO_URL),
          ]);

          const groupedAddress = groupAddress(address);
          const cellWidth = content.width - wrapper.padding * 2;
          const addressTextWidth = cellWidth - addressCell.paddingX * 2;

          // measuring pass: canvas resize resets ctx state, so measure first,
          // then resize + scale + draw
          canvas.width = width * CANVAS_SCALE;
          ctx.font = toCanvasFont(titleStyle.size, titleStyle.weight);
          const titleBlockGap = titleLogo?.hasGap ? titleStyle.blockGap : 0;
          const titleLogoLines =
            titleLogo && titleLogoImg
              ? layoutTitleWithLogo(ctx, {
                  before: titleLogo.before,
                  symbol: titleLogo.symbol,
                  after: titleLogo.after,
                  gap: titleBlockGap,
                  maxWidth: content.width,
                })
              : null;
          const titleLines = titleLogoLines
            ? []
            : wrapText(ctx, title, content.width);
          const titleHeight =
            (titleLogoLines ?? titleLines).length * titleStyle.lineHeight;

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
          ctx.textBaseline = 'top';
          if (titleLogoLines && titleLogoImg) {
            titleLogoLines.forEach((line, index) => {
              drawTitleLineWithLogo(ctx, line, titleLogoImg, {
                centerX: width / 2,
                y: content.paddingTop + index * titleStyle.lineHeight,
                gap: titleBlockGap,
              });
            });
          } else {
            ctx.textAlign = 'center';
            titleLines.forEach((line, index) => {
              ctx.fillText(
                line,
                width / 2,
                content.paddingTop + index * titleStyle.lineHeight,
              );
            });
          }

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
            await drawDotQRCodeOnCanvas(ctx, {
              value: address,
              x: qrX,
              y: qrY,
              size: qr.size,
              // high error correction: the center plate occludes part of the code
              ecl: 'H',
              // dots under the plate are cleared like the on-screen code
              clearPlateSize: qr.logoPlateSize,
            });

            // the OneKey mark on a round white plate, as ReceiveQRCode has it
            const centerX = qrX + qr.size / 2;
            const centerY = qrY + qr.size / 2;
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            ctx.arc(centerX, centerY, qr.logoPlateSize / 2, 0, Math.PI * 2);
            ctx.fill();
            drawQRCodeBrandMark(ctx, {
              x: centerX - qr.logoSize / 2,
              y: centerY - qr.logoSize / 2,
              size: qr.logoSize,
            });
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
      }, [contentKey, title, titleLogo, subtitle, networkName, address]);

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
