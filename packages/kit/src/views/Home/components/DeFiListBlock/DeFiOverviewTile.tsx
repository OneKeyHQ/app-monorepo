import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import { SizableText, Stack, XStack, YStack } from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
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

const TABULAR_NUMS: ['tabular-nums'] = ['tabular-nums'];

export type IDeFiOverviewTileProps = {
  protocol: IDeFiProtocol;
  protocolInfo: IProtocolSummary | undefined;
  netWorth: number | string;
  isAllNetworks?: boolean;
  onPress: () => void;
};

function DeFiOverviewTile({
  protocol,
  protocolInfo,
  netWorth,
  isAllNetworks,
  onPress,
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

  return (
    <XStack
      flex={1}
      bg="$bgSubdued"
      borderRadius="$3"
      px="$4"
      py="$3.5"
      alignItems="center"
      gap="$3"
      cursor="pointer"
      focusable
      focusVisibleStyle={{
        outlineColor: '$focusRing',
        outlineStyle: 'solid',
        outlineWidth: 2,
      }}
      hoverStyle={{ bg: '$bgHover' }}
      pressStyle={{ bg: '$bgActive' }}
      $platform-web={{ boxShadow: OVERVIEW_TILE_SHADOW }}
      $platform-native={{
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '$borderSubdued',
      }}
      onPress={onPress}
      role="button"
      aria-label={`${name}. ${detailsLabel}`}
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
        <SizableText
          size="$bodyMd"
          color="$textSubdued"
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {name}
        </SizableText>
        <SizableText
          size="$bodyLgMedium"
          numberOfLines={1}
          fontVariant={TABULAR_NUMS}
        >
          {formattedNetWorth}
        </SizableText>
      </YStack>
    </XStack>
  );
}

export { DeFiOverviewTile };
