import { memo, useEffect, useRef } from 'react';

import { Stack, useTheme } from '@onekeyhq/components';

import type { ITradingViewNativeProps } from './types';

const FULL_CIRCLE_RADIANS = Math.PI * 2;

interface IClockColors {
  background: string;
  border: string;
  primary: string;
  secondary: string;
  accent: string;
}

function drawHand({
  context,
  angle,
  length,
  lineWidth,
  color,
}: {
  context: CanvasRenderingContext2D;
  angle: number;
  length: number;
  lineWidth: number;
  color: string;
}) {
  context.save();
  context.rotate(angle);
  context.beginPath();
  context.moveTo(0, length * 0.12);
  context.lineTo(0, -length);
  context.lineCap = 'round';
  context.lineWidth = lineWidth;
  context.strokeStyle = color;
  context.stroke();
  context.restore();
}

function drawClock(canvas: HTMLCanvasElement, now: Date, colors: IClockColors) {
  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }

  const { width, height } = canvas.getBoundingClientRect();
  if (width <= 0 || height <= 0) {
    return;
  }

  const pixelRatio = Math.max(globalThis.devicePixelRatio || 1, 1);
  const pixelWidth = Math.round(width * pixelRatio);
  const pixelHeight = Math.round(height * pixelRatio);

  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }

  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, width, height);
  context.fillStyle = colors.background;
  context.fillRect(0, 0, width, height);

  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * 0.36;

  context.save();
  context.translate(centerX, centerY);

  context.beginPath();
  context.arc(0, 0, radius, 0, FULL_CIRCLE_RADIANS);
  context.lineWidth = Math.max(radius * 0.018, 1);
  context.strokeStyle = colors.border;
  context.stroke();

  for (let index = 0; index < 12; index += 1) {
    const angle = (index / 12) * FULL_CIRCLE_RADIANS;
    const markerLength = index % 3 === 0 ? radius * 0.1 : radius * 0.05;
    const outerRadius = radius * 0.86;

    context.beginPath();
    context.moveTo(
      Math.sin(angle) * (outerRadius - markerLength),
      -Math.cos(angle) * (outerRadius - markerLength),
    );
    context.lineTo(
      Math.sin(angle) * outerRadius,
      -Math.cos(angle) * outerRadius,
    );
    context.lineCap = 'round';
    context.lineWidth = Math.max(radius * 0.018, 1);
    context.strokeStyle = colors.secondary;
    context.stroke();
  }

  const seconds = now.getSeconds();
  const minutes = now.getMinutes() + seconds / 60;
  const hours = (now.getHours() % 12) + minutes / 60;

  drawHand({
    context,
    angle: (hours / 12) * FULL_CIRCLE_RADIANS,
    length: radius * 0.48,
    lineWidth: Math.max(radius * 0.055, 2),
    color: colors.primary,
  });
  drawHand({
    context,
    angle: (minutes / 60) * FULL_CIRCLE_RADIANS,
    length: radius * 0.68,
    lineWidth: Math.max(radius * 0.035, 1.5),
    color: colors.primary,
  });
  drawHand({
    context,
    angle: (seconds / 60) * FULL_CIRCLE_RADIANS,
    length: radius * 0.76,
    lineWidth: Math.max(radius * 0.012, 1),
    color: colors.accent,
  });

  context.beginPath();
  context.arc(0, 0, Math.max(radius * 0.045, 2), 0, FULL_CIRCLE_RADIANS);
  context.fillStyle = colors.accent;
  context.fill();
  context.restore();
}

export const TradingViewNative = memo(({ testID }: ITradingViewNativeProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const theme = useTheme();
  const background = theme.bgApp.val;
  const border = theme.borderSubdued.val;
  const primary = theme.text.val;
  const secondary = theme.textSubdued.val;
  const accent = theme.textInfo.val;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }

    const renderClock = () => {
      drawClock(canvas, new Date(), {
        background,
        border,
        primary,
        secondary,
        accent,
      });
    };

    renderClock();
    const timer = globalThis.setInterval(renderClock, 1000);
    const resizeObserver = new ResizeObserver(renderClock);
    resizeObserver.observe(canvas);

    return () => {
      globalThis.clearInterval(timer);
      resizeObserver.disconnect();
    };
  }, [accent, background, border, primary, secondary]);

  return (
    <Stack flex={1} w="100%" h="100%" bg="$bgApp">
      <canvas
        ref={canvasRef}
        data-testid={testID}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
        }}
      />
    </Stack>
  );
});

TradingViewNative.displayName = 'TradingViewNative';
