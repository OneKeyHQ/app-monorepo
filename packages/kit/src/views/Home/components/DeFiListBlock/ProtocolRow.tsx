import { memo, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ProtocolValueCell } from '@onekeyhq/kit/src/components/DeFi/ProtocolValueCell';
import { getProtocolValueState } from '@onekeyhq/kit/src/components/DeFi/protocolValueUtils';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { useDeFiListSupportedActionsAtom } from '@onekeyhq/kit/src/states/jotai/contexts/deFiList';
import {
  buildProtocolDisplayInfo,
  getProtocolActionBadgeLabelIds,
} from '@onekeyhq/kit/src/utils/defiPositionUtils';
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
    const [{ supportedActions }] = useDeFiListSupportedActionsAtom();
    const currencySymbol = settings.currencyInfo.symbol;

    const protocolDisplayInfo = useMemo(
      () =>
        buildProtocolDisplayInfo({
          protocol,
          protocolInfo,
        }),
      [protocol, protocolInfo],
    );
    const protocolValueState = useMemo(
      () => getProtocolValueState(protocol),
      [protocol],
    );
    // The actions this protocol's detail page can perform, previewed as badges.
    const actionLabelIds = useMemo(
      () => getProtocolActionBadgeLabelIds({ protocol, supportedActions }),
      [protocol, supportedActions],
    );
    const hasPartialUnavailableValue =
      protocolValueState.hasAvailableValue &&
      protocolValueState.hasUnavailableValue;
    const priceUnavailableLabel = intl.formatMessage({
      id: ETranslations.wallet_price_unavailable,
    });
    const partialPriceUnavailableLabel = intl.formatMessage({
      id: ETranslations.wallet_partial_price_unavailable,
    });
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
        <YStack flexShrink={0} alignItems="flex-end" gap="$1">
          <Stack maxWidth={120} alignItems="flex-end">
            <ProtocolValueCell
              value={protocolValueState.value}
              currencySymbol={currencySymbol}
              priceUnavailableLabel={priceUnavailableLabel}
              partialPriceUnavailableLabel={partialPriceUnavailableLabel}
              isUnavailable={!protocolValueState.hasAvailableValue}
              showPriceUnavailableTooltip={hasPartialUnavailableValue}
              size="$bodyLgMedium"
              textAlign="right"
              numberOfLines={1}
            />
          </Stack>
          {actionLabelIds.length > 0 ? (
            <XStack
              justifyContent="flex-end"
              alignItems="center"
              gap="$1"
              flexWrap="wrap"
              maxWidth={180}
            >
              {actionLabelIds.map((labelId) => (
                <Badge key={labelId} badgeType="info" badgeSize="sm">
                  {intl.formatMessage({ id: labelId })}
                </Badge>
              ))}
            </XStack>
          ) : null}
        </YStack>
      </ListItem>
    );
  },
);
ProtocolRow.displayName = 'ProtocolRow';

export { ProtocolRow };
