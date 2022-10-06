// @ts-gnore
import React, { useCallback } from 'react';
import { Box } from '@onekeyhq/components/src';
import { Platform } from 'react-native';
import Canvas, {
  CanvasGradient,
  CanvasRenderingContext2D,
} from 'react-native-canvas';

type SparkLineChartProps = {
  data?: number[];
  lineColor?: string;
  height?: number;
  width?: number;
  range?: number;
  lineWidth?: number;
  smooth?: boolean;
  scale?: number;
  linearGradientColor?: string;
};

const offsetHeight = 10;

const throttlenSparklinePoints = (data?: number[], range = 50) => {
  // range / data.length
  const res = [];
  if (data) {
    const fillteData = data.filter((value) => value);
    if (fillteData.length < range) {
      return fillteData;
    }

    const valueStep = Math.floor(data.length / range);
    for (let i = 0; i < range; i += 1) {
      res.push(data[i * valueStep]);
    }
  }
  // console.log('sparkline resArray:', res);
  return res;
};

const SparkLineChart: React.FC<SparkLineChartProps> = ({
  data,
  range = 20,
  lineColor = 'rgba(0, 184, 18, 1)',
  linearGradientColor = 'rgba(0, 184, 18, 0.3)',
  height = 40,
  width = 50,
  lineWidth = 2,
  smooth = true,
  scale = 0.1,
}) => {
  const draw = useCallback(
    (canvas: Canvas | HTMLCanvasElement | null) => {
      if (canvas) {
        canvas.width = width;
        canvas.height = height + offsetHeight;
        const showData = throttlenSparklinePoints(data, range);
        const maxValue = Math.max(...showData);
        const minValue = Math.min(...showData);
        const yStep = height / (maxValue - minValue);
        const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
        if (ctx) {
          ctx.beginPath();
          ctx.lineWidth = lineWidth;
          ctx.strokeStyle = lineColor;
          const xSpath = width / (showData.length - 1);
          let xPoint = 0;
          let lastYpoint = 0;
          showData.forEach((v, i) => {
            const yPoint = height - (v - minValue) * yStep;
            if (smooth && i >= 2 && i < showData.length - 1) {
              // draw bezier
              const pre1X = xSpath * (i - 1);
              const pre1Y = height - (showData[i - 1] - minValue) * yStep;
              const pre2X = xSpath * (i - 2);
              const pre2Y = height - (showData[i - 2] - minValue) * yStep;
              const nextX = xSpath * (i + 1);
              const nextY = height - (showData[i + 1] - minValue) * yStep;
              const cp1x = pre1X + (xPoint - pre2X) * scale;
              const cp1y = pre1Y + (yPoint - pre2Y) * scale;
              const cp2x = xPoint - (nextX - pre1X) * scale;
              const cp2y = yPoint - (nextY - pre1Y) * scale;
              ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, xPoint, yPoint);
            } else {
              ctx.lineTo(xPoint, yPoint);
            }
            if (i === showData.length - 1) {
              lastYpoint = yPoint;
            }
            xPoint += xSpath;
          });
          ctx.lineTo(xPoint, height + offsetHeight);
          ctx.lineTo(0, height + offsetHeight);
          ctx.stroke();
          ctx.closePath();
          const grad = ctx.createLinearGradient(0, 0, 0, height);
          grad.addColorStop(0, linearGradientColor);
          grad.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = grad;
          ctx.fill();
          xPoint -= xSpath;
          // clear last 2 line
          ctx.clearRect(xPoint, lastYpoint, xSpath, lastYpoint + offsetHeight);
          ctx.clearRect(
            0,
            height + offsetHeight - lineWidth,
            width + xSpath,
            lineWidth,
          );
        }
      }
    },
    [
      data,
      height,
      lineColor,
      lineWidth,
      range,
      width,
      smooth,
      scale,
      linearGradientColor,
    ],
  );

  return Platform.OS === 'web' ? (
    <div style={{ width, height: height + offsetHeight }}>
      <canvas ref={draw} />
    </div>
  ) : (
    <Box w={width} h={height + offsetHeight}>
      <Canvas ref={draw} />
    </Box>
  );
};

export default React.memo(SparkLineChart);
