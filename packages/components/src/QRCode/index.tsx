/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import type { FC } from 'react';
import { useMemo } from 'react';

import QRCodeUtil from 'qrcode';
import Svg, { Circle, ClipPath, Defs, G, Image, Rect } from 'react-native-svg';

import type { ImageProps } from 'react-native';

export type QRCodeProps = {
  size: number;
  ecl?: 'L' | 'M' | 'Q' | 'H';
  logo?: ImageProps['source'];
  logoBackgroundColor?: string;
  logoMargin?: number;
  logoSize?: number;
  value: string;
};

const generateMatrix = (
  value: string,
  errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H',
) => {
  const arr = Array.prototype.slice.call(
    QRCodeUtil.create(value, { errorCorrectionLevel }).modules.data,
    0,
  );
  const sqrt = Math.sqrt(arr.length);
  return arr.reduce(
    (rows, key, index) =>
      (index % sqrt === 0
        ? rows.push([key])
        : rows[rows.length - 1].push(key)) && rows,
    [],
  );
};

const QRCode: FC<QRCodeProps> = ({
  ecl = 'M',
  logo,
  logoBackgroundColor = '0xFFFFFF',
  logoMargin = 5,
  logoSize = 62,
  size,
  value,
}) => {
  const href = logo;

  const dots = useMemo(() => {
    const arr: any[] = [];
    const qrList = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ];
    const matrix = generateMatrix(value, ecl);
    const cellSize = size / matrix.length;
    qrList.forEach(({ x, y }) => {
      const x1 = (matrix.length - 7) * cellSize * x;
      const y1 = (matrix.length - 7) * cellSize * y;
      for (let i = 0; i < 3; i += 1) {
        arr.push(
          <Rect
            key={`Rect${x}${y}${i}`}
            fill={i % 2 !== 0 ? 'white' : 'black'}
            x={x1 + cellSize * i}
            y={y1 + cellSize * i}
            width={cellSize * (7 - i * 2)}
            height={cellSize * (7 - i * 2)}
            rx={(i - 3) * -6 + (i === 0 ? 2 : 0)} // calculated border radius for corner squares
            ry={(i - 3) * -6 + (i === 0 ? 2 : 0)} // calculated border radius for corner squares
          />,
        );
      }
    });

    const clearArenaSize = Math.floor((logoSize + 3) / cellSize);
    const matrixMiddleStart = matrix.length / 2 - clearArenaSize / 2;
    const matrixMiddleEnd = matrix.length / 2 + clearArenaSize / 2 - 1;
    matrix.forEach((row: any[], i: number) => {
      row.forEach((column, j) => {
        if (matrix[i][j]) {
          if (
            !(
              (i < 7 && j < 7) ||
              (i > matrix.length - 8 && j < 7) ||
              (i < 7 && j > matrix.length - 8)
            )
          ) {
            if (
              !(
                i >= matrixMiddleStart &&
                i <= matrixMiddleEnd &&
                j >= matrixMiddleStart &&
                j <= matrixMiddleEnd
              )
            ) {
              arr.push(
                <Circle
                  key={`circel row${i} col${j}`}
                  cx={i * cellSize + cellSize / 2}
                  cy={j * cellSize + cellSize / 2}
                  fill="black"
                  r={cellSize / 3} // calculate size of single dots
                />,
              );
            }
          }
        }
      });
    });
    return arr;
  }, [ecl, logoSize, size, value]);
  const logoPosition = size / 2 - logoSize / 2 - logoMargin;
  const logoWrapperSize = logoSize + logoMargin * 2;
  return (
    <Svg height={size} width={size}>
      <Defs>
        <ClipPath id="clip-wrapper">
          <Rect height={logoWrapperSize} width={logoWrapperSize} />
        </ClipPath>
        <ClipPath id="clip-logo">
          <Rect height={logoSize} width={logoSize} />
        </ClipPath>
      </Defs>
      <Rect fill="white" height={size} width={size} />
      {dots}
      {logo && (
        <G x={logoPosition} y={logoPosition}>
          <Rect
            clipPath="url(#clip-wrapper)"
            fill={logoBackgroundColor}
            height={logoWrapperSize}
            width={logoWrapperSize}
          />
          <G x={logoMargin} y={logoMargin}>
            <Image
              clipPath="url(#clip-logo)"
              height={logoSize}
              href={href}
              preserveAspectRatio="xMidYMid slice"
              width={logoSize}
            />
          </G>
        </G>
      )}
    </Svg>
  );
};

export default QRCode;
