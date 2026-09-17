import { memo, useCallback, useMemo } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useThemeVariant } from '../../../hooks/useThemeVariant';

import { Canvas } from './Canvas';

import type { ICanvas } from './type';
import type { CanvasRenderingContext2D } from 'react-native-canvas';

const useDevicePixelRatio = () =>
  useMemo(() => (platformEnv.isNative ? 1 : window.devicePixelRatio || 1), []);

type ISparkLineChartProps = {
  data?: number[];
  lineColor: string;
  height?: number;
  width?: number;
  lineWidth?: number;
  smooth?: boolean;
  scale?: number;
  linearGradientColor: string;
};

const offsetY = 5;

export const MARKET_SPARKLINE_COLORS = {
  dark: {
    positive: ['rgba(70, 254, 165, 1)', 'rgba(70, 254, 165, 0.2)'],
    negative: ['rgba(255, 149, 146, 1)', 'rgba(255, 149, 146, 0.2)'],
  },
  light: {
    positive: ['rgba(0, 113, 63, 1)', 'rgba(0, 113, 63, 0.2)'],
    negative: ['rgba(196, 0, 6, 1)', 'rgba(196, 0, 6, 0.2)'],
  },
} as const;

const SparkLineChart = ({
  data,
  lineColor,
  linearGradientColor,
  height = 40,
  width = 50,
  lineWidth = 1,
  smooth = true,
  scale = 0.1,
}: ISparkLineChartProps) => {
  const devicePixelRatio = useDevicePixelRatio();
  const theme = useThemeVariant();
  const draw = useCallback(
    // eslint-disable-next-line @typescript-eslint/require-await
    async (canvas: ICanvas | HTMLCanvasElement | null) => {
      if (canvas) {
        canvas.width = width * devicePixelRatio;
        canvas.height = height * devicePixelRatio;
        const calculateHeight = height - offsetY;
        const showData = data || [];
        const maxValue = Math.max(...showData);
        const minValue = Math.min(...showData);
        const yStep = calculateHeight / (maxValue - minValue);
        // A flat series would divide by zero, so pin it to the vertical middle.
        const getY = (value: number) =>
          maxValue === minValue
            ? calculateHeight / 2
            : calculateHeight - (value - minValue) * yStep;
        const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
        if (ctx) {
          ctx.scale(devicePixelRatio, devicePixelRatio);
          ctx.beginPath();
          ctx.lineWidth = lineWidth;
          ctx.strokeStyle = lineColor;
          const xPath = width / (showData.length - 1);
          let xPoint = 0;
          let lastY = 0;
          showData.forEach((v, i) => {
            const yPoint = getY(v);
            if (smooth && i >= 2 && i < showData.length - 1) {
              // draw bezier
              const pre1X = xPath * (i - 1);
              const pre1Y = getY(showData[i - 1]);
              const pre2X = xPath * (i - 2);
              const pre2Y = getY(showData[i - 2]);
              const nextX = xPath * (i + 1);
              const nextY = getY(showData[i + 1]);
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
            xPoint += xPath;
          });
          ctx.lineTo(xPoint + xPath, lastY);
          ctx.lineTo(xPoint + xPath, height);
          ctx.lineTo(0, height);
          ctx.stroke();
          ctx.closePath();
          const grad = platformEnv.isNative
            ? // eslint-disable-next-line @typescript-eslint/await-thenable
              await ctx.createLinearGradient(0, 0, 0, calculateHeight)
            : ctx.createLinearGradient(0, 0, 0, calculateHeight);
          grad.addColorStop(0, linearGradientColor);
          grad.addColorStop(
            1,
            theme === 'dark' ? 'rgba(0,0,0,0)' : 'rgba(255,255,255,0)',
          );
          ctx.fillStyle = grad;
          ctx.fill();
          // clear last line
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
      linearGradientColor,
      theme,
      smooth,
      scale,
    ],
  );

  return <Canvas width={width} height={height} ref={draw as any} />;
};

export default memo(SparkLineChart);
