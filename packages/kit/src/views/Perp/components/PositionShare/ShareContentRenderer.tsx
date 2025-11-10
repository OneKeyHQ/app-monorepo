import { useIntl } from 'react-intl';

import {
  Image,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { getHyperliquidTokenImageUrl } from '@onekeyhq/shared/src/utils/perpsUtils';

import {
  BACKGROUNDS,
  CANVAS_CONFIG,
  REFERRAL_CODE,
  SHOW_REFERRAL_CODE,
  STICKERS,
} from './constants';

import type { IShareConfig, IShareData } from './types';

interface IShareContentRendererProps {
  data: IShareData;
  config: IShareConfig;
  scale?: number;
}

const { size, padding, colors, fonts, layout, display } = CANVAS_CONFIG;

export function ShareContentRenderer({
  data,
  config,
  scale = 1,
}: IShareContentRendererProps) {
  const intl = useIntl();
  const {
    side,
    token,
    tokenImageUrl,
    pnl,
    pnlPercent,
    leverage,
    entryPrice,
    markPrice,
  } = data;
  const pnlNum = parseFloat(pnl);
  const pnlPercentNum = parseFloat(pnlPercent);
  const pnlColor = pnlNum >= 0 ? colors.long : colors.short;
  const pnlSign = pnlPercentNum >= 0 ? '+' : '';
  const sideColor = side === 'long' ? colors.long : colors.short;
  const tokenImage = tokenImageUrl || getHyperliquidTokenImageUrl(token);
  const selectedSticker =
    config.stickerIndex !== null ? STICKERS[config.stickerIndex] : null;

  const isProfit = pnlNum >= 0;
  const availableBackgrounds = isProfit ? BACKGROUNDS.profit : BACKGROUNDS.loss;
  const allBackgrounds = [...BACKGROUNDS.neutral, ...availableBackgrounds];
  const selectedBackground = allBackgrounds[config.backgroundIndex] ?? null;

  const scaledSize = size * scale;
  const scaledPadding = padding * scale;
  const scaledFonts = {
    coin: fonts.coin * scale,
    side: fonts.side * scale,
    pnl: fonts.pnl * scale,
    priceLabel: fonts.priceLabel * scale,
    priceValue: fonts.priceValue * scale,
  };
  const scaledLayout = {
    tokenSize: layout.tokenSize * scale,
    stickerSize: layout.stickerSize * scale,
  };
  const tokenY = layout.tokenY * scale;

  return (
    <YStack
      width={scaledSize}
      height={scaledSize}
      position="relative"
      collapsable={platformEnv.isNativeAndroid ? false : undefined}
    >
      {selectedBackground ? (
        <Image
          source={selectedBackground}
          width={scaledSize}
          height={scaledSize}
          position="absolute"
          top={0}
          left={0}
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
                  {`${intl.formatMessage({
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
            top={
              layout.pnlY * scale - (scaledFonts.pnl * layout.lineHeight) / 2
            }
            left={scaledPadding}
          >
            <SizableText
              fontSize={scaledFonts.pnl}
              lineHeight={scaledFonts.pnl * layout.lineHeight}
              fontWeight="600"
              color={pnlColor}
            >
              {`${pnlSign}${pnlPercent}%`}
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
              {intl.formatMessage({
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
              {intl.formatMessage({
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

        {selectedSticker ? (
          <SizableText
            position="absolute"
            right={scaledPadding}
            bottom={scaledPadding}
            fontSize={scaledLayout.stickerSize}
            lineHeight={scaledLayout.stickerSize * layout.lineHeight}
          >
            {selectedSticker}
          </SizableText>
        ) : null}
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
          >
            <YStack gap={layout.priceGap}>
              <SizableText
                fontSize={scaledFonts.priceLabel}
                fontWeight="600"
                color={colors.textTertiary}
                opacity={layout.labelOpacity}
                lineHeight={scaledFonts.priceLabel * layout.lineHeight}
              >
                {intl.formatMessage({
                  id: ETranslations.referral_referral_link,
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
          </Stack>
        ) : null}
      </YStack>
    </YStack>
  );
}
