import { memo, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, YStack } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { buildProtocolDisplayInfo } from '@onekeyhq/kit/src/utils/defiPositionUtils';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IDeFiProtocol,
  IProtocolSummary,
} from '@onekeyhq/shared/types/defi';

export type IProtocolRowProps = {
  protocol: IDeFiProtocol;
  protocolInfo?: IProtocolSummary;
  onPress?: () => void;
  isAllNetworks?: boolean;
};

const ProtocolRow = memo(
  ({ protocol, protocolInfo, onPress, isAllNetworks }: IProtocolRowProps) => {
    const intl = useIntl();
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
    // Match the desktop accordion header's "{n} 持仓" sub-label so the
    // condensed mobile row carries the same density signal.
    const positionCountText = `${protocol.positions.length} ${intl.formatMessage(
      { id: ETranslations.earn_positions },
    )}`;

    return (
      <ListItem
        key={`${protocol.protocol}-${protocol.networkId}`}
        gap="$3"
        alignItems="center"
        justifyContent="space-between"
        minHeight={60}
        mx="$0"
        px="$5"
        py="$2"
        borderRadius="$0"
        onPress={onPress}
        drillIn
      >
        <Token
          size="lg"
          tokenImageUri={protocolDisplayInfo.protocolLogo}
          showNetworkIcon={isAllNetworks}
          networkId={protocol.networkId}
        />
        <YStack flex={1} minWidth={0} gap="$0.5">
          <SizableText size="$bodyLgMedium" numberOfLines={1}>
            {protocolDisplayInfo.protocolName}
          </SizableText>
          <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
            {positionCountText}
          </SizableText>
        </YStack>
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
