import { memo, useMemo } from 'react';

import { SizableText, XStack } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { buildProtocolDisplayInfo } from '@onekeyhq/kit/src/utils/defiPositionUtils';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type {
  IDeFiProtocol,
  IProtocolSummary,
} from '@onekeyhq/shared/types/defi';

export type IProtocolRowProps = {
  protocol: IDeFiProtocol;
  protocolInfo?: IProtocolSummary;
  /**
   * compact renders the grid-cell variant used by DeFiOverviewCard
   * (24pt logo, $bodyMd name, $bodyMdMedium value).
   * Default is the list-row variant used by ProtocolListLayout.
   */
  compact?: boolean;
  /** Rendered right-aligned alongside the value. Used by Overview cell for "% of portfolio". */
  trailing?: React.ReactNode;
  onPress?: () => void;
  /**
   * Only consumed by the list variant (!compact) so the Token badge
   * reflects the all-networks view. The compact variant always omits
   * the network badge to stay within the 24pt cell footprint.
   */
  isAllNetworks?: boolean;
};

const ProtocolRow = memo(
  ({
    protocol,
    protocolInfo,
    compact,
    trailing,
    onPress,
    isAllNetworks,
  }: IProtocolRowProps) => {
    const [settings] = useSettingsPersistAtom();
    const currencySymbol = settings.currencyInfo.symbol;

    const protocolDisplayInfo = useMemo(
      () =>
        buildProtocolDisplayInfo({
          protocol,
          protocolInfo,
        }),
      [protocol, protocolInfo],
    );

    if (compact) {
      return (
        <XStack
          alignItems="center"
          gap="$2"
          bg="$bgSubdued"
          borderRadius="$3"
          px="$3"
          py="$2.5"
          hoverStyle={{ bg: '$bgHover' }}
          pressStyle={{ bg: '$bgActive' }}
          onPress={onPress}
          cursor={onPress ? 'pointer' : undefined}
        >
          <Token
            size="sm"
            tokenImageUri={protocolDisplayInfo.protocolLogo}
            networkId={protocol.networkId}
          />
          <SizableText size="$bodyMd" numberOfLines={1} flex={1}>
            {protocolDisplayInfo.protocolName}
          </SizableText>
          <NumberSizeableTextWrapper
            hideValue
            size="$bodyMdMedium"
            formatter="value"
            formatterOptions={{ currency: currencySymbol }}
            textAlign="right"
            flexShrink={0}
          >
            {protocolDisplayInfo.netWorth}
          </NumberSizeableTextWrapper>
          {trailing}
        </XStack>
      );
    }

    return (
      <ListItem
        key={`${protocol.protocol}-${protocol.networkId}`}
        gap="$3"
        alignItems="center"
        justifyContent="space-between"
        onPress={onPress}
        drillIn
      >
        <Token
          size="md"
          tokenImageUri={protocolDisplayInfo.protocolLogo}
          showNetworkIcon={isAllNetworks}
          networkId={protocol.networkId}
        />
        <SizableText size="$bodyLgMedium" numberOfLines={1} flex={1}>
          {protocolDisplayInfo.protocolName}
        </SizableText>
        <NumberSizeableTextWrapper
          hideValue
          size="$bodyLgMedium"
          formatter="value"
          formatterOptions={{ currency: currencySymbol }}
          textAlign="right"
          flexShrink={0}
          maxWidth={120}
        >
          {protocolDisplayInfo.netWorth}
        </NumberSizeableTextWrapper>
      </ListItem>
    );
  },
);
ProtocolRow.displayName = 'ProtocolRow';

export { ProtocolRow };
