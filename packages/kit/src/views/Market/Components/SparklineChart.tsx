// @ts-gnore
import React, { useCallback } from 'react';

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
};

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
  range = 50,
  lineColor = 'green',
  height = 50,
  width = 100,
  lineWidth = 2,
}) => {
  const draw = useCallback(
    (canvas: Canvas | HTMLCanvasElement | null) => {
      if (canvas) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        canvas.width = width;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        canvas.height = height;
        const showData = throttlenSparklinePoints(data, range);
        const maxValue = Math.max(...showData);
        const minValue = Math.min(...showData);
        const yStep = height / (maxValue - minValue);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
        if (ctx) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
          ctx.beginPath();
          ctx.lineWidth = lineWidth;
          ctx.strokeStyle = lineColor;
          const xSpath = width / (showData.length - 1);
          let xPoint = 0;
          let lastYpoint = 0;
          showData.forEach((v, i) => {
            const yPoint = height - (v - minValue) * yStep;
            ctx.lineTo(xPoint, yPoint);
            if (i >= showData.length - 1) {
              if (yPoint < height) {
                ctx.lineTo(xPoint, height);
              }
              lastYpoint = yPoint;
            }
            xPoint += xSpath;
          });
          ctx.lineTo(0, height);
          ctx.stroke();
          ctx.closePath();
          xPoint -= xSpath;
         // console.log('xpoint', xPoint, 'lastY', lastYpoint);
          ctx.clearRect(xPoint, lastYpoint, lineWidth, height - lastYpoint);
          ctx.clearRect(0, height, lineWidth, lineWidth);

          const grad = ctx.createLinearGradient(0, 0, 0, height);
          grad.addColorStop(0, lineColor || 'green');
          grad.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = grad;
          ctx.fill();
        }
      }
    },
    [data, height, lineColor, lineWidth, range, width],
  );

  return Platform.OS === 'web' ? <canvas ref={draw} /> : <Canvas ref={draw} />;
};

export default React.memo(SparkLineChart);
