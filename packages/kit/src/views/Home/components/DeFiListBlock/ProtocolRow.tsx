import { memo, useMemo } from 'react';

import { SizableText } from '@onekeyhq/components';
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
  onPress?: () => void;
  isAllNetworks?: boolean;
};

const ProtocolRow = memo(
  ({ protocol, protocolInfo, onPress, isAllNetworks }: IProtocolRowProps) => {
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
