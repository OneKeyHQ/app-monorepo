import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { SizableText, Stack, XStack, YStack } from '@onekeyhq/components';
import type { ColorTokens } from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { ANIMATE_ONLY_BG_COLOR } from '@onekeyhq/kit/src/views/Earn/components/desktopHome/earnDesktopColorEase';
import { buildKeyboardPressProps } from '@onekeyhq/kit/src/views/Earn/components/desktopHome/earnDesktopPressable';
import {
  useSettingsPersistAtom,
  useSettingsValuePersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IDeFiProtocol,
  IProtocolSummary,
} from '@onekeyhq/shared/types/defi';

import { OVERVIEW_TILE_SHADOW } from './DeFiOverviewLayout';
import { formatPortfolioTotal } from './formatPortfolioTotal';

/**
 * A page's own card colors for the tiles, at rest, hovered and pressed (the
 * Earn pages'). Opt-in: with it the tiles drop their ring, ease the color
 * and, on web, take a Tab stop that presses on Enter and Space. Without it
 * they render and tab as the wallet's DeFi Portfolio does.
 */
export type IDeFiOverviewTileSurface = Record<
  'rest' | 'hover' | 'press',
  ColorTokens
>;

/** The eased color and the keyboard of a tile with a surface; none without */
export function useOverviewTileSurfaceProps(
  surface: IDeFiOverviewTileSurface | undefined,
  onPress: () => void,
) {
  const reduceMotion = useReducedMotion();
  if (!surface) {
    return undefined;
  }
  return {
    transition: reduceMotion ? undefined : ('quick' as const),
    animateOnly: ANIMATE_ONLY_BG_COLOR,
    ...buildKeyboardPressProps(onPress, 2),
  };
}

export type IDeFiOverviewTileProps = {
  protocol: IDeFiProtocol;
  protocolInfo: IProtocolSummary | undefined;
  netWorth: number | string;
  isAllNetworks?: boolean;
  onPress: () => void;
  surface?: IDeFiOverviewTileSurface;
  /** beside the name, what tells the tile from another of the same name */
  nameAccessory?: ReactNode;
};

function DeFiOverviewTile({
  protocol,
  protocolInfo,
  netWorth,
  isAllNetworks,
  onPress,
  surface,
  nameAccessory,
}: IDeFiOverviewTileProps) {
  const intl = useIntl();
  const [settings] = useSettingsPersistAtom();
  const [settingsValue] = useSettingsValuePersistAtom();
  const currencySymbol = settings.currencyInfo.symbol;
  const name = protocolInfo?.protocolName ?? protocol.protocol;
  const logo = protocolInfo?.protocolLogo;
  const detailsLabel = intl.formatMessage({ id: ETranslations.global_details });
  const formattedNetWorth = formatPortfolioTotal(
    Number(netWorth) || 0,
    currencySymbol,
    settingsValue.hideValue,
  );
  const surfaceProps = useOverviewTileSurfaceProps(surface, onPress);

  return (
    <XStack
      flex={1}
      bg={surface?.rest ?? '$bgSubdued'}
      borderRadius="$3"
      px="$3"
      py="$2.5"
      alignItems="center"
      gap="$2.5"
      cursor="pointer"
      focusable
      focusVisibleStyle={{
        outlineColor: '$focusRing',
        outlineStyle: 'solid',
        outlineWidth: 2,
      }}
      hoverStyle={{ bg: surface?.hover ?? '$bgHover' }}
      pressStyle={{ bg: surface?.press ?? '$bgActive' }}
      $platform-web={surface ? undefined : { boxShadow: OVERVIEW_TILE_SHADOW }}
      $platform-native={
        surface
          ? undefined
          : {
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: '$borderSubdued',
            }
      }
      onPress={onPress}
      role="button"
      aria-label={`${name}. ${detailsLabel}`}
      {...surfaceProps}
    >
      <Stack
        width={36}
        height={36}
        flexShrink={0}
        alignItems="center"
        justifyContent="center"
      >
        <Stack
          width={32}
          height={32}
          borderRadius="$full"
          bg="$bgApp"
          alignItems="center"
          justifyContent="center"
        >
          <Token
            size="md"
            tokenImageUri={logo}
            networkId={protocol.networkId}
            showNetworkIcon={Boolean(isAllNetworks && protocol.networkId)}
          />
        </Stack>
      </Stack>
      <YStack flex={1} minWidth={0} gap="$1">
        {nameAccessory ? (
          // The name's own line height, whatever the accessory's
          <XStack ai="center" gap="$1.5" minWidth={0} h="$5">
            <SizableText
              size="$bodyMd"
              color="$textSubdued"
              numberOfLines={1}
              ellipsizeMode="tail"
              flexShrink={1}
            >
              {name}
            </SizableText>
            {nameAccessory}
          </XStack>
        ) : (
          <SizableText
            size="$bodyMd"
            color="$textSubdued"
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {name}
          </SizableText>
        )}
        <SizableText size="$bodyLgMedium" numberOfLines={1}>
          {formattedNetWorth}
        </SizableText>
      </YStack>
    </XStack>
  );
}

export { DeFiOverviewTile };
