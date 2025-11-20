import { useCallback, useEffect, useMemo, useRef } from 'react';

import BigNumber from 'bignumber.js';

import {
  Image,
  QRCode,
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
    : BACKGROUNDS.loss[0];

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
    pnlDisplayText.length > 6
      ? scaledFonts.pnl * (1 - (pnlDisplayText.length - 6) * 0.06)
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
            gap={layout.priceGap * scale}
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
            gap={layout.priceGap * scale}
          >
            <SizableText
              fontSize={scaledFonts.priceLabel}
              fontWeight="600"
              color={colors.textSecondary}
              opacity={layout.labelOpacity}
              lineHeight={scaledFonts.priceLabel * layout.lineHeight}
            >
              {priceType === 'exit'
                ? appLocale.intl.formatMessage({
                    id: ETranslations.perp_position_exit_price,
                  })
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
              <YStack gap={layout.priceGap * scale}>
                <SizableText
                  fontSize={scaledFonts.priceLabel}
                  fontWeight="600"
                  color={colors.textTertiary}
                  opacity={layout.labelOpacity}
                  lineHeight={scaledFonts.priceLabel * layout.lineHeight}
                >
                  {appLocale.intl.formatMessage({
                    id: ETranslations.perp_share_referral_desc,
                  })}
                </SizableText>
                <SizableText
                  fontSize={scaledFonts.priceValue}
                  fontWeight="600"
                  color={colors.textTertiary}
                  lineHeight={scaledFonts.priceValue * layout.lineHeight}
                >
                  {REFERRAL_CODE}
                </SizableText>
              </YStack>
              <QRCode
                value={REFERRAL_CODE}
                size={layout.qrCodeSize * scale - 5}
                padding={5}
              />
            </XStack>
          </Stack>
        ) : null}
      </YStack>
    </YStack>
  );
}
