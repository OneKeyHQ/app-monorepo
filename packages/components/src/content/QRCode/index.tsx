import type { ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';

import QRCodeUtil from 'qrcode';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  Image,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';

import { type IAirGapUrJson, airGapUrUtils } from '@onekeyhq/qr-wallet-sdk';

import { useThemeValue } from '../../hooks';
import { Icon } from '../../primitives';

import type { IThemeColorKeys } from '../../hooks';
import type { IIconProps } from '../../primitives';
import type { ImageProps, ImageURISource } from 'react-native';

export type IQrcodeDrawType = 'dot' | 'line' | 'animated';

type IBasicQRCodeProps = {
  size: number;
  ecl?: 'L' | 'M' | 'Q' | 'H';
  logo?: ImageProps['source'];
  logoSvg?: IIconProps['name'];
  logoSvgColor?: IIconProps['color'];
  logoBackgroundColor?: IThemeColorKeys;
  logoMargin?: number;
  logoSize?: number;
  value: string;
  interval?: number;
  quietZone?: number;
  enableLinearGradient?: boolean;
  gradientDirection?: string[];
  linearGradient?: string[];
  // If drawType is line, the logo will not be displayed
  drawType?: IQrcodeDrawType;
};

const generateMatrix = (
  value: string,
  errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H',
): number[][] => {
  const arr: number[] = Array.prototype.slice.call(
    QRCodeUtil.create(value, { errorCorrectionLevel }).modules.data,
    0,
  );
  const sqrt = Math.sqrt(arr.length);
  return arr.reduce((rows: number[][], key, index) => {
    if (index % sqrt === 0) {
      rows.push([key]);
    } else {
      rows[rows.length - 1].push(key);
    }
    return rows;
  }, []);
};

const transformMatrixIntoPath = (matrix: number[][], size: number) => {
  const cellSize = size / matrix.length;
  let path = '';
  matrix.forEach((row, i) => {
    let needDraw = false;
    row.forEach((column, j) => {
      if (column) {
        if (!needDraw) {
          path += `M${cellSize * j} ${cellSize / 2 + cellSize * i} `;
          needDraw = true;
        }
        if (needDraw && j === matrix.length - 1) {
          path += `L${cellSize * (j + 1)} ${cellSize / 2 + cellSize * i} `;
        }
      } else if (needDraw) {
        path += `L${cellSize * j} ${cellSize / 2 + cellSize * i} `;
        needDraw = false;
      }
    });
  });
  return {
    cellSize,
    path,
  };
};

function BasicQRCode({
  ecl = 'H',
  logo,
  logoSvg,
  logoBackgroundColor: logoBGColor = 'bgApp',
  logoSvgColor = '$text',
  logoMargin = 5,
  logoSize = 62,
  size,
  value,
  quietZone = 0,
  drawType = 'line',
  enableLinearGradient = false,
  gradientDirection = ['0%', '0%', '100%', '100%'],
  linearGradient = ['rgb(255,0,0)', 'rgb(0,255,255)'],
}: IBasicQRCodeProps) {
  const logoBackgroundColor = useThemeValue(logoBGColor);
  const href = (logo as ImageURISource)?.uri ?? logo;
  const primaryColor = useThemeValue('text');
  const secondaryColor = useThemeValue('bgApp');

  const result = useMemo(() => {
    const matrix = generateMatrix(value, ecl);
    if (drawType === 'dot') {
      const arr: ReactElement[] = [];
      const qrList = [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
      ];
      const cellSize = size / matrix.length;
      qrList.forEach(({ x, y }) => {
        const x1 = (matrix.length - 7) * cellSize * x;
        const y1 = (matrix.length - 7) * cellSize * y;
        for (let i = 0; i < 3; i += 1) {
          arr.push(
            <Rect
              key={`Rect${x}${y}${i}`}
              fill={i % 2 !== 0 ? secondaryColor : primaryColor}
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
                    key={`circle row${i} col${j}`}
                    cx={i * cellSize + cellSize / 2}
                    cy={j * cellSize + cellSize / 2}
                    fill={primaryColor}
                    r={cellSize / 3} // calculate size of single dots
                  />,
                );
              }
            }
          }
        });
      });
      return arr;
    }
    const { path, cellSize } = transformMatrixIntoPath(matrix, size);
    return (
      <>
        <Defs>
          <LinearGradient
            id="grad"
            x1={gradientDirection[0]}
            y1={gradientDirection[1]}
            x2={gradientDirection[2]}
            y2={gradientDirection[3]}
          >
            <Stop offset="0" stopColor={linearGradient[0]} stopOpacity="1" />
            <Stop offset="1" stopColor={linearGradient[1]} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <G>
          <Rect
            x={-quietZone}
            y={-quietZone}
            width={size + quietZone * 2}
            height={size + quietZone * 2}
            fill={secondaryColor}
          />
        </G>
        <G>
          <Path
            d={path}
            strokeLinecap="butt"
            stroke={enableLinearGradient ? 'url(#grad)' : primaryColor}
            strokeWidth={cellSize}
          />
        </G>
      </>
    );
  }, [
    ecl,
    enableLinearGradient,
    gradientDirection,
    drawType,
    linearGradient,
    logoSize,
    primaryColor,
    quietZone,
    secondaryColor,
    size,
    value,
  ]);
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
      <Rect fill={secondaryColor} height={size} width={size} />
      {result}
      {logo || logoSvg ? (
        <G x={logoPosition} y={logoPosition}>
          <Rect
            clipPath="url(#clip-wrapper)"
            fill={logoBackgroundColor}
            height={logoWrapperSize}
            width={logoWrapperSize}
            rx={drawType === 'line' ? 9999 : undefined}
          />
          <G x={logoMargin} y={logoMargin}>
            {logo ? (
              <Image
                clipPath="url(#clip-logo)"
                height={logoSize}
                href={href}
                preserveAspectRatio="xMidYMid slice"
                width={logoSize}
              />
            ) : null}
            {logoSvg ? (
              <Icon
                name="OnekeyBrand"
                width={logoSize}
                height={logoSize}
                color={logoSvgColor}
              />
            ) : null}
          </G>
        </G>
      ) : null}
    </Svg>
  );
}
export interface IQRCodeProps extends Omit<IBasicQRCodeProps, 'value'> {
  value?: string;
  valueUr?: IAirGapUrJson;
  interval?: number;
}
export function QRCode({
  value,
  valueUr,
  interval = 100,
  drawType,
  ...props
}: IQRCodeProps) {
  const [partValue, setPartValue] = useState<string>(value || '');

  useEffect(() => {
    let timerId: ReturnType<typeof setInterval>;
    if (drawType === 'animated') {
      if (!valueUr) {
        throw new Error('valueUr is required for animated QRCode');
      }
      const { nextPart } = airGapUrUtils.createAnimatedUREncoder({
        ur: valueUr,
        maxFragmentLength: 100,
        firstSeqNum: 0,
      });
      // const urEncoder = new UREncoder(UR.fromBuffer(Buffer.from(value)));
      timerId = setInterval(() => {
        const part = nextPart();
        setPartValue(part);
      }, interval);
    }
    return () => clearInterval(timerId);
  }, [value, interval, drawType, valueUr]);

  if (!partValue) {
    // TODO return Skeleton
    return null;
  }
  return <BasicQRCode value={partValue} drawType={drawType} {...props} />;
}
