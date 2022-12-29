import type { FC } from 'react';
import { memo, useCallback } from 'react';

import Canvas from 'react-native-canvas';

import { Box } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useDevicePixelRatio } from '../../hooks/useMarketLayout';

import type { CanvasRenderingContext2D } from 'react-native-canvas';

type SparkLineChartProps = {
  data?: number[];
  lineColor?: string;
  height?: number;
  width?: number;
  lineWidth?: number;
  smooth?: boolean;
  scale?: number;
  linearGradientColor?: string;
};

const offsetY = 5;

const SparkLineChart: FC<SparkLineChartProps> = ({
  data,
  lineColor = 'rgba(0, 184, 18, 1)',
  linearGradientColor = 'rgba(0, 184, 18, 0.3)',
  height = 40,
  width = 50,
  lineWidth = 2,
  smooth = true,
  scale = 0.1,
}) => {
  const devicePixelRatio = useDevicePixelRatio();
  const draw = useCallback(
    // eslint-disable-next-line @typescript-eslint/require-await
    async (canvas: Canvas | HTMLCanvasElement | null) => {
      if (canvas) {
        canvas.width = width * devicePixelRatio;
        canvas.height = height * devicePixelRatio;
        const calculateHeight = height - offsetY;
        const showData = data || [];
        const maxValue = Math.max(...showData);
        const minValue = Math.min(...showData);
        const yStep = calculateHeight / (maxValue - minValue);
        const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
        if (ctx) {
          ctx.scale(devicePixelRatio, devicePixelRatio);
          ctx.beginPath();
          ctx.lineWidth = lineWidth;
          ctx.strokeStyle = lineColor;
          const xSpath = width / (showData.length - 1);
          let xPoint = 0;
          let lastY = 0;
          showData.forEach((v, i) => {
            const yPoint = calculateHeight - (v - minValue) * yStep;
            if (smooth && i >= 2 && i < showData.length - 1) {
              // draw bezier
              const pre1X = xSpath * (i - 1);
              const pre1Y =
                calculateHeight - (showData[i - 1] - minValue) * yStep;
              const pre2X = xSpath * (i - 2);
              const pre2Y =
                calculateHeight - (showData[i - 2] - minValue) * yStep;
              const nextX = xSpath * (i + 1);
              const nextY =
                calculateHeight - (showData[i + 1] - minValue) * yStep;
              const cp1x = pre1X + (xPoint - pre2X) * scale;
              let cp1y = pre1Y + (yPoint - pre2Y) * scale;
              const cp2x = xPoint - (nextX - pre1X) * scale;
              let cp2y = yPoint - (nextY - pre1Y) * scale;
              if (cp1y < 0) cp1y = 0;
              if (cp2y < 0) cp2y = 0;
              ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, xPoint, yPoint);
            } else {
              ctx.lineTo(xPoint, yPoint);
            }
            if (i === showData.length - 1) lastY = yPoint;
            xPoint += xSpath;
          });
          ctx.lineTo(xPoint + xSpath, lastY);
          ctx.lineTo(xPoint, height);
          ctx.lineTo(0, height);
          ctx.stroke();
          ctx.closePath();
          const grad = platformEnv.isNative
            ? // eslint-disable-next-line @typescript-eslint/await-thenable
              await ctx.createLinearGradient(0, 0, 0, calculateHeight)
            : ctx.createLinearGradient(0, 0, 0, calculateHeight);
          grad.addColorStop(0, linearGradientColor);
          grad.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = grad;
          ctx.fill();

          xPoint -= lineWidth;
          // clear last 2 line
          ctx.clearRect(xPoint, 0, xSpath, height);
          ctx.clearRect(0, height - lineWidth, width, lineWidth);
        }
      }
    },
    [
      width,
      devicePixelRatio,
      height,
      data,
      lineWidth,
      lineColor,
      smooth,
      scale,
      linearGradientColor,
    ],
  );

  return !platformEnv.isNative ? (
    <div style={{ width, height }}>
      <canvas
        style={{
          width: `${width}px`,
          height: `${height}px`,
        }}
        ref={draw}
      />
    </div>
  ) : (
    <Box>
      <Canvas
        style={{
          width,
          height,
        }}
        ref={draw}
      />
    </Box>
  );
};

export default memo(SparkLineChart);
