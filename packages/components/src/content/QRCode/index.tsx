import { useEffect, useId, useMemo, useState } from 'react';

import Svg, { ClipPath, Defs, G, Image, Path, Rect } from 'react-native-svg';

import {
  TamaguiTheme as Theme,
  getTokenValue,
} from '@onekeyhq/components/src/shared/tamagui';
import type { IAirGapUrJson } from '@onekeyhq/qr-wallet-sdk';

import { Icon } from '../../primitives/Icon';
import { Stack } from '../../primitives/Stack';

import {
  generateMatrix,
  getQRCodeDotCells,
  getQRCodeDotsPath,
  getQRCodeFinderRings,
  getQRCodeLayoutMetrics,
  getQRCodeLogoClearArenaSize,
  getQRCodePlateBorderRadius,
} from './QRCode.utils';

import type { IQRCodeErrorCorrectionLevel } from './QRCode.utils';
import type { IIconProps } from '../../primitives';
import type { ImageProps, ImageURISource } from 'react-native';

export type IQrcodeDrawType = 'dot' | 'line';

type IBasicQRCodeProps = {
  size: number;
  ecl?: IQRCodeErrorCorrectionLevel;
  logo?: ImageProps['source'];
  logoSvg?: IIconProps['name'];
  logoSvgColor?: IIconProps['color'];
  // Use RGB color, please avoid using colors that are close to black.
  logoBackgroundColor?: string;
  logoBorderRadius?: number;
  logoMargin?: number;
  logoSize?: number;
  value: string;
  // Color of the dark modules. Keep it far from the light background so the
  // code stays scannable.
  darkColor?: string;
  drawType?: IQrcodeDrawType;
};

const DEFAULT_LOGO_MARGIN = 3;
const DEFAULT_LOGO_SIZE = 62;

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
  logoBackgroundColor: logoBGColor,
  logoBorderRadius,
  logoSvgColor = '$text',
  logoMargin = DEFAULT_LOGO_MARGIN,
  logoSize = DEFAULT_LOGO_SIZE,
  size,
  value,
  drawType = 'dot',
  darkColor: darkColorProp,
}: IBasicQRCodeProps) {
  const href = (logo as ImageURISource)?.uri ?? logo;
  const primaryColor = getTokenValue('$textLight', 'color');
  const secondaryColor = getTokenValue('$bgAppLight', 'color');
  const logoBackgroundColor = logoBGColor || secondaryColor;
  const hasLogo = Boolean(logo || logoSvg);
  const darkColor = darkColorProp || primaryColor;
  const result = useMemo(() => {
    const matrix = generateMatrix(value, ecl);
    const cellSize = size / matrix.length;
    if (drawType === 'dot') {
      const clearArenaModules = hasLogo
        ? getQRCodeLogoClearArenaSize({ logoSize, logoMargin, cellSize })
        : 0;
      // one path for the whole dot field: the dots share a fill and never
      // overlap, so this is a single node instead of one per dark module
      const dotsPath = getQRCodeDotsPath({
        cells: getQRCodeDotCells({ matrix, clearArenaModules }),
        cellSize,
      });
      return (
        <>
          {getQRCodeFinderRings({ matrixSize: matrix.length, cellSize }).map(
            (ring) => (
              <Rect
                key={`finder-${ring.x}-${ring.y}-${ring.size}`}
                fill={ring.isDark ? darkColor : secondaryColor}
                x={ring.x}
                y={ring.y}
                width={ring.size}
                height={ring.size}
                rx={ring.radius}
                ry={ring.radius}
              />
            ),
          )}
          <Path d={dotsPath} fill={darkColor} />
        </>
      );
    }
    const { path } = transformMatrixIntoPath(matrix, size);
    return (
      <Path
        d={path}
        strokeLinecap="butt"
        stroke={darkColor}
        strokeWidth={cellSize}
      />
    );
  }, [
    ecl,
    darkColor,
    drawType,
    hasLogo,
    logoMargin,
    logoSize,
    secondaryColor,
    size,
    value,
  ]);
  const logoPosition = size / 2 - logoSize / 2 - logoMargin;
  const logoWrapperSize = logoSize + logoMargin * 2;
  const logoRadius = logoBorderRadius ?? 9999;
  // clipPath ids live in the document, not the <Svg>, so two codes on one
  // screen would both resolve to whichever defined them first and the second
  // logo would be clipped to the first one's shape.
  const clipIdSuffix = useId().replace(/[^a-zA-Z0-9]/g, '');
  const wrapperClipId = `qrLogoWrapper${clipIdSuffix}`;
  const logoClipId = `qrLogo${clipIdSuffix}`;

  return (
    <Svg height={size} width={size}>
      {hasLogo ? (
        <Defs>
          <ClipPath id={wrapperClipId}>
            <Rect
              height={logoWrapperSize}
              width={logoWrapperSize}
              rx={logoRadius}
              ry={logoRadius}
            />
          </ClipPath>
          <ClipPath id={logoClipId}>
            <Rect
              height={logoSize}
              width={logoSize}
              rx={logoRadius}
              ry={logoRadius}
            />
          </ClipPath>
        </Defs>
      ) : null}
      <Rect fill={secondaryColor} height={size} width={size} />
      {result}
      {hasLogo ? (
        <G x={logoPosition} y={logoPosition}>
          <Rect
            clipPath={`url(#${wrapperClipId})`}
            fill={logoBackgroundColor}
            height={logoWrapperSize}
            width={logoWrapperSize}
            rx={logoRadius}
            ry={logoRadius}
          />
          <G x={logoMargin} y={logoMargin}>
            {logo ? (
              <Image
                clipPath={`url(#${logoClipId})`}
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
  padding?: number;
  // Uses size + padding as the fixed canvas and shrinks the symbol so each
  // side keeps this many full modules of quiet zone.
  quietZoneModules?: number;
}

export function QRCode({
  value,
  valueUr,
  interval = 500,
  drawType,
  padding = 10,
  quietZoneModules = 0,
  ...props
}: IQRCodeProps) {
  const [partValue, setPartValue] = useState<string>(value || '');

  useEffect(() => {
    let timerId: ReturnType<typeof setInterval> | undefined;
    let cancelled = false;
    if (valueUr) {
      void (async () => {
        const { airGapUrUtils } = await import('@onekeyhq/qr-wallet-sdk');
        // Guard against unmount/deps-change during the async import so we
        // don't create an interval that no cleanup will ever reach.
        if (cancelled) return;
        const { nextPart, encodeWhole } = airGapUrUtils.createAnimatedUREncoder(
          {
            ur: valueUr,
            maxFragmentLength: 30,
            firstSeqNum: 0,
          },
        );
        if (process.env.NODE_ENV !== 'production') {
          console.log('QRCode >>>> encodeWhole', encodeWhole());
          console.log(`\n\n ${encodeWhole().join('\n\n').toUpperCase()} \n\n`);
        }
        timerId = setInterval(() => {
          const part = nextPart();
          setPartValue(part);
        }, interval);
      })();
    }
    return () => {
      cancelled = true;
      if (timerId) clearInterval(timerId);
    };
  }, [value, interval, valueUr]);

  // An air-gap UR is inherently multi-frame, so its presence is what makes the
  // code animated. Callers that want a static code pass `value` instead.
  const displayValue = valueUr ? partValue : value || '';
  if (!displayValue) {
    // TODO return Skeleton
    return null;
  }
  const { canvasSize, qrCodeSize, symbolScale, quietZoneSize } =
    getQRCodeLayoutMetrics({
      value: displayValue,
      ecl: props.ecl ?? 'H',
      size: props.size,
      padding,
      quietZoneModules,
    });
  const scaledLogoSize = (props.logoSize ?? DEFAULT_LOGO_SIZE) * symbolScale;
  const scaledLogoMargin =
    (props.logoMargin ?? DEFAULT_LOGO_MARGIN) * symbolScale;
  const plateBorderRadius = getQRCodePlateBorderRadius(quietZoneSize);
  return (
    <Theme name="light">
      <Stack
        width={canvasSize}
        height={canvasSize}
        bg="$bgApp"
        borderRadius={plateBorderRadius}
        borderCurve="continuous"
        jc="center"
        ai="center"
      >
        <BasicQRCode
          value={displayValue}
          drawType={drawType}
          {...props}
          size={qrCodeSize}
          logoSize={scaledLogoSize}
          logoMargin={scaledLogoMargin}
        />
      </Stack>
    </Theme>
  );
}
