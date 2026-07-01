import { memo } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, XStack, YStack } from '@onekeyhq/components';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { Token } from '@onekeyhq/kit/src/components/Token';
import type { ITokenProps } from '@onekeyhq/kit/src/components/Token';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IDeFiProtocol,
  IDeFiSupportedProtocolAction,
} from '@onekeyhq/shared/types/defi';

import {
  type ILocalizedProtocolPositionSection,
  getSectionActionPlacement,
} from '../../utils/defiPositionUtils';

import { ProtocolPositionActionButton } from './ProtocolPositionActionButton';
import { ProtocolValueCell } from './ProtocolValueCell';
import { isProtocolAssetValueUnavailable } from './protocolValueUtils';

import type { IProtocolPositionActionSuccessParams } from './ProtocolPositionActionDialog';

// Floor width for the per-asset action button. Right-aligned on its own line,
// the buttons already share a right edge; this min-width keeps a short label
// (Repay) from collapsing into a tiny pill and lets same-section buttons match.
const PER_ASSET_ACTION_MIN_WIDTH = 84;

// When the action props are supplied, each asset gets its own scoped
// Withdraw/Repay/Claim button on a dedicated line below its balance (the
// mobile/detail per-asset layout). Putting the action on its own line keeps it
// off the value column's right edge, so the "AMOUNT" header lines up above the
// numbers. Omit the props and the section renders read-only (e.g. a unified
// position whose action lives in a single position-level button below).
type IProtocolPositionSectionActionProps = {
  accountId?: string;
  indexedAccountId?: string;
  protocol: IDeFiProtocol;
  actionPosition: IDeFiProtocol['positions'][number];
  supportedActions: IDeFiSupportedProtocolAction[];
  onActionSuccess?: (
    params: IProtocolPositionActionSuccessParams,
  ) => void | Promise<void>;
};

const ProtocolPositionSection = memo(
  ({
    itemKeyPrefix,
    section,
    currencySymbol,
    priceUnavailableLabel,
    tokenSize = 'sm',
    actionProps,
  }: {
    itemKeyPrefix: string;
    section: ILocalizedProtocolPositionSection;
    currencySymbol: string;
    priceUnavailableLabel: string;
    tokenSize?: ITokenProps['size'];
    actionProps?: IProtocolPositionSectionActionProps;
  }) => {
    const intl = useIntl();
    const amountLabel = intl.formatMessage({
      id: ETranslations.content__amount,
    });
    // Withdraw with supplied, Repay with borrowed, Claim with rewards.
    const actionPlacement = getSectionActionPlacement(section.assetType);
    const showAssetActions = Boolean(actionProps && actionPlacement);
    return (
      <YStack bg="$bgSubdued" borderRadius="$2" px="$3" py="$2" gap="$2">
        <XStack alignItems="center" justifyContent="space-between">
          <SizableText size="$bodySmMedium" color="$text">
            {section.title}
          </SizableText>
          <SizableText size="$bodySmMedium" color="$textSubdued">
            {amountLabel}
          </SizableText>
        </XStack>
        {section.assets.map((asset, assetIndex) => {
          const actionNode =
            showAssetActions && actionProps ? (
              <ProtocolPositionActionButton
                accountId={actionProps.accountId}
                indexedAccountId={actionProps.indexedAccountId}
                protocol={actionProps.protocol}
                position={actionProps.actionPosition}
                supportedActions={actionProps.supportedActions}
                placement={actionPlacement}
                manageAsset={asset}
                visualVariant="info"
                actionMinWidth={PER_ASSET_ACTION_MIN_WIDTH}
                containerProps={{ justifyContent: 'flex-start' }}
                onSuccess={actionProps.onActionSuccess}
              />
            ) : null;
          const tokenLabel = (
            <XStack alignItems="center" gap="$2" flex={1} minWidth={0}>
              <Token
                size={tokenSize}
                tokenImageUri={asset.meta?.logoUrl}
                bg="$bgStrong"
              />
              <SizableText size="$bodyMdMedium" numberOfLines={1} flex={1}>
                {asset.symbol}
              </SizableText>
            </XStack>
          );
          const valueCell = (
            <ProtocolValueCell
              value={asset.value}
              currencySymbol={currencySymbol}
              priceUnavailableLabel={priceUnavailableLabel}
              isUnavailable={isProtocolAssetValueUnavailable(asset)}
            />
          );
          const amountText = (
            <NumberSizeableTextWrapper
              hideValue
              size="$bodyMd"
              color="$textSubdued"
              formatter="balance"
              textAlign="right"
            >
              {asset.amount}
            </NumberSizeableTextWrapper>
          );
          return (
            <YStack
              key={`${itemKeyPrefix}-${section.key}-${asset.address}-${assetIndex}`}
              gap="$1"
            >
              {actionNode ? (
                // Per-asset action sits on the left of the second line, level
                // with the amount on the right: it reuses the value/amount
                // column's two-line height instead of adding a third
                // full-width row, and balances visual weight left↔right.
                <>
                  <XStack alignItems="center" gap="$3">
                    {tokenLabel}
                    {valueCell}
                  </XStack>
                  <XStack
                    alignItems="center"
                    gap="$3"
                    justifyContent="space-between"
                  >
                    {actionNode}
                    {amountText}
                  </XStack>
                </>
              ) : (
                <XStack alignItems="center" gap="$3" minHeight={44}>
                  {tokenLabel}
                  <YStack alignItems="flex-end" minWidth={0} flexShrink={1}>
                    {valueCell}
                    {amountText}
                  </YStack>
                </XStack>
              )}
            </YStack>
          );
        })}
      </YStack>
    );
  },
);
ProtocolPositionSection.displayName = 'ProtocolPositionSection';

export { ProtocolPositionSection };
