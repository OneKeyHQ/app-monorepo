import { useCallback, useEffect, useMemo, useRef } from 'react';

import BigNumber from 'bignumber.js';
import QRCodeUtil from 'qrcode';
import Svg, { G, Path } from 'react-native-svg';

import {
  Image,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { getHyperliquidTokenImageUrl } from '@onekeyhq/shared/src/utils/perpsUtils';

import {
  BACKGROUNDS,
  CANVAS_CONFIG,
  REFERRAL_CODE,
  SHOW_REFERRAL_CODE,
  getPnlDisplayInfo,
} from './constants';

import type { IShareConfig, IShareData } from './types';

interface IShareContentRendererProps {
  data: IShareData;
  config: IShareConfig;
  scale?: number;
  onImagesReady?: () => void;
}

const { size, padding, colors, fonts, layout, display } = CANVAS_CONFIG;

function generateQRCodeMatrix(
  value: string,
  errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H' = 'H',
): number[][] {
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
}

function transformMatrixIntoPath(matrix: number[][], qrSize: number) {
  const cellSize = qrSize / matrix.length;
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
}

function QRCodeRenderer({
  value,
  size: qrSize,
}: {
  value: string;
  size: number;
}) {
  const matrix = useMemo(() => generateQRCodeMatrix(value, 'H'), [value]);
  const { path, cellSize } = useMemo(
    () => transformMatrixIntoPath(matrix, qrSize),
    [matrix, qrSize],
  );

  return (
    <Svg height={qrSize} width={qrSize}>
      <G>
        <Path
          d={path}
          strokeLinecap="butt"
          stroke="#FFFFFF"
          strokeWidth={cellSize}
        />
      </G>
    </Svg>
  );
}

export function ShareContentRenderer({
  data,
  config,
  scale = 1,
  onImagesReady,
}: IShareContentRendererProps) {
  const {
    side,
    token,
    tokenImageUrl,
    pnl,
    leverage,
    entryPrice,
    markPrice,
    priceType = 'mark',
  } = data;
  const pnlBn = new BigNumber(pnl || '0');
  const isProfit = pnlBn.isGreaterThan(0);
  const pnlColor = isProfit ? colors.long : colors.short;
  const sideColor = side === 'long' ? colors.long : colors.short;
  const tokenImage = tokenImageUrl || getHyperliquidTokenImageUrl(token);
  // Sticker temporarily disabled
  // const selectedSticker =
  //   config.stickerIndex !== null ? STICKERS[config.stickerIndex] : null;
  const pnlDisplayMode = config.pnlDisplayMode;

  const selectedBackground = isProfit
    ? BACKGROUNDS.profit[0]
    : BACKGROUNDS.loss[1];

  const scaledSize = size * scale;
  const scaledPadding = padding * scale;
  const scaledFonts = useMemo(
    () => ({
      coin: fonts.coin * scale,
      side: fonts.side * scale,
      pnl: fonts.pnl * scale,
      priceLabel: fonts.priceLabel * scale,
      priceValue: fonts.priceValue * scale,
    }),
    [scale],
  );
  const scaledLayout = useMemo(
    () => ({
      tokenSize: layout.tokenSize * scale,
      stickerSize: layout.stickerSize * scale,
    }),
    [scale],
  );
  const tokenY = layout.tokenY * scale;
  const pnlDisplayText = getPnlDisplayInfo(data, pnlDisplayMode);
  const pnlFontSize =
    pnlDisplayText.length > 8
      ? scaledFonts.pnl * (1 - (pnlDisplayText.length - 8) * 0.05)
      : scaledFonts.pnl;

  const imageLoadCountRef = useRef(0);
  const expectedImageCount = useRef(0);

  const handleImageLoad = useCallback(() => {
    imageLoadCountRef.current += 1;
    if (
      onImagesReady &&
      imageLoadCountRef.current >= expectedImageCount.current
    ) {
      onImagesReady();
    }
  }, [onImagesReady]);

  useEffect(() => {
    imageLoadCountRef.current = 0;
    expectedImageCount.current = 0;
    if (selectedBackground) expectedImageCount.current += 1;
    if (display.showTokenIcon) expectedImageCount.current += 1;
    if (expectedImageCount.current === 0 && onImagesReady) {
      onImagesReady();
    }
  }, [selectedBackground, onImagesReady]);

  return (
    <YStack
      width={scaledSize}
      height={scaledSize}
      position="relative"
      collapsable={platformEnv.isNativeAndroid ? false : undefined}
    >
      {selectedBackground ? (
        <Image
          source={{ uri: selectedBackground }}
          width={scaledSize}
          height={scaledSize}
          position="absolute"
          top={0}
          left={0}
          onLoad={handleImageLoad}
          onError={handleImageLoad}
        />
      ) : null}

      <YStack
        width={scaledSize}
        height={scaledSize}
        padding={scaledPadding}
        position="relative"
      >
        <YStack
          position="absolute"
          top={tokenY - scaledLayout.tokenSize / 2}
          left={scaledPadding}
        >
          <XStack alignItems="center" gap="$2">
            {display.showTokenIcon ? (
              <Stack
                width={scaledLayout.tokenSize}
                height={scaledLayout.tokenSize}
                borderRadius="$full"
                overflow="hidden"
                backgroundColor="$bgSubdued"
              >
                <Image
                  source={{ uri: tokenImage }}
                  width={scaledLayout.tokenSize}
                  height={scaledLayout.tokenSize}
                  onLoad={handleImageLoad}
                  onError={handleImageLoad}
                />
              </Stack>
            ) : null}

            {display.showCoinName ? (
              <SizableText
                fontSize={scaledFonts.coin}
                lineHeight={scaledFonts.coin * layout.lineHeight}
                fontWeight="600"
                color={colors.textPrimary}
              >
                {token}
              </SizableText>
            ) : null}

            {display.showSideAndLeverage ? (
              <XStack
                py={layout.badgePaddingY * scale}
                px={layout.badgePaddingX * scale}
                borderRadius="$3"
                bg={
                  side === 'long'
                    ? colors.sideLongBackground
                    : colors.sideShortBackground
                }
              >
                <SizableText
                  fontSize={scaledFonts.side}
                  lineHeight={scaledFonts.side * layout.lineHeight}
                  fontWeight="600"
                  color={sideColor}
                >
                  {`${appLocale.intl.formatMessage({
                    id:
                      side === 'long'
                        ? ETranslations.perp_long
                        : ETranslations.perp_short,
                  })} ${leverage}X`}
                </SizableText>
              </XStack>
            ) : null}
          </XStack>
        </YStack>

        {display.showPnl ? (
          <Stack
            position="absolute"
            top={layout.pnlY * scale - (pnlFontSize * layout.lineHeight) / 2}
            left={scaledPadding}
          >
            <SizableText
              fontSize={pnlFontSize}
              lineHeight={pnlFontSize * layout.lineHeight}
              fontWeight="600"
              color={pnlColor}
            >
              {pnlDisplayText}
            </SizableText>
          </Stack>
        ) : null}

        {display.showEntryPrice ? (
          <YStack
            position="absolute"
            top={
              layout.entryPriceY * scale -
              (scaledFonts.priceLabel * layout.lineHeight) / 2
            }
            left={scaledPadding}
            gap={layout.priceGap}
          >
            <SizableText
              fontSize={scaledFonts.priceLabel}
              fontWeight="600"
              color={colors.textSecondary}
              opacity={layout.labelOpacity}
              lineHeight={scaledFonts.priceLabel * layout.lineHeight}
            >
              {appLocale.intl.formatMessage({
                id: ETranslations.perp_position_entry_price,
              })}
            </SizableText>
            <SizableText
              fontSize={scaledFonts.priceValue}
              fontWeight="600"
              color={colors.textPrimary}
              lineHeight={scaledFonts.priceValue * layout.lineHeight}
            >
              {entryPrice}
            </SizableText>
          </YStack>
        ) : null}

        {display.showMarkPrice ? (
          <YStack
            position="absolute"
            top={
              layout.markPriceY * scale -
              (scaledFonts.priceLabel * layout.lineHeight) / 2
            }
            left={scaledPadding}
            gap={layout.priceGap}
          >
            <SizableText
              fontSize={scaledFonts.priceLabel}
              fontWeight="600"
              color={colors.textSecondary}
              opacity={layout.labelOpacity}
              lineHeight={scaledFonts.priceLabel * layout.lineHeight}
            >
              {priceType === 'exit'
                ? 'Exit Price'
                : appLocale.intl.formatMessage({
                    id: ETranslations.perp_position_mark_price,
                  })}
            </SizableText>
            <SizableText
              fontSize={scaledFonts.priceValue}
              fontWeight="600"
              color={colors.textPrimary}
              lineHeight={scaledFonts.priceValue * layout.lineHeight}
            >
              {markPrice}
            </SizableText>
          </YStack>
        ) : null}

        {/* Sticker temporarily disabled */}
        {/* {selectedSticker ? (
          <SizableText
            position="absolute"
            right={scaledPadding}
            bottom={scaledPadding}
            fontSize={scaledLayout.stickerSize}
            lineHeight={scaledLayout.stickerSize * layout.lineHeight}
          >
            {selectedSticker}
          </SizableText>
        ) : null} */}
        {SHOW_REFERRAL_CODE ? (
          <Stack
            position="absolute"
            bottom={0}
            left={0}
            right={0}
            height={layout.referralHeight * scale}
            backgroundColor={colors.referralBackground}
            justifyContent="center"
            paddingLeft={scaledPadding}
            paddingRight={scaledPadding}
          >
            <XStack
              alignItems="center"
              justifyContent="space-between"
              width="100%"
            >
              <YStack gap={layout.priceGap}>
                {/* <SizableText
                  fontSize={scaledFonts.priceLabel}
                  fontWeight="600"
                  color={colors.textTertiary}
                  opacity={layout.labelOpacity}
                  lineHeight={scaledFonts.priceLabel * layout.lineHeight}
                >
                  {appLocale.intl.formatMessage({
                    id: ETranslations.referral_referral_link,
                  })}
                </SizableText> */}
                <SizableText
                  fontSize={scaledFonts.priceValue}
                  fontWeight="600"
                  color={colors.textTertiary}
                  lineHeight={scaledFonts.priceValue * layout.lineHeight}
                >
                  {REFERRAL_CODE}
                </SizableText>
              </YStack>
              <QRCodeRenderer
                value={REFERRAL_CODE}
                size={layout.qrCodeSize * scale}
              />
            </XStack>
          </Stack>
        ) : null}
      </YStack>
    </YStack>
  );
}
