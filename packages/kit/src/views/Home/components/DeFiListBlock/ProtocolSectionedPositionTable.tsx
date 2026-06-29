import { Fragment, memo, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, Stack, XStack, YStack } from '@onekeyhq/components';
import { ProtocolPositionActionButton } from '@onekeyhq/kit/src/components/DeFi/ProtocolPositionActionButton';
import type { IProtocolPositionActionSuccessParams } from '@onekeyhq/kit/src/components/DeFi/ProtocolPositionActionDialog';
import { ProtocolValueCell } from '@onekeyhq/kit/src/components/DeFi/ProtocolValueCell';
import { isProtocolAssetValueUnavailable } from '@onekeyhq/kit/src/components/DeFi/protocolValueUtils';
import { Token } from '@onekeyhq/kit/src/components/Token';
import type { ILocalizedProtocolPositionItem } from '@onekeyhq/kit/src/utils/defiPositionUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IDeFiProtocol,
  IDeFiSupportedProtocolAction,
} from '@onekeyhq/shared/types/defi';

import { ProtocolAssetBalanceText } from './ProtocolAssetBalanceText';
import {
  ACTION_BUTTON_CONTAINER_PROPS,
  BALANCE_FLEX_WITHOUT_REWARDS,
  POSITION_COLUMN_WIDTH,
  PROTOCOL_TABLE_COLUMN_GAP,
  USD_FLEX_WITHOUT_REWARDS,
} from './ProtocolUnifiedTable';

// Sectioned positions preserve Supplied/Borrowed/Rewards as explicit segments.
// This is used for lending and debt-bearing non-lending positions because the
// unified table has no Borrowed column.
//
// The Supplied segment uses "Positions" in the first header cell to align with
// the unified table; Borrowed and Rewards keep their semantic labels.

const TABULAR_NUMS: ['tabular-nums'] = ['tabular-nums'];

function getTableSectionActionPlacement(
  assetType: ILocalizedProtocolPositionItem['sections'][number]['assetType'],
): 'balance' | 'rewards' | 'debt' | undefined {
  if (assetType === 'rewards') return 'rewards';
  if (assetType === 'supplied' || assetType === 'other') return 'balance';
  if (assetType === 'borrowed') return 'debt';
  return undefined;
}

type IProtocolSectionedPositionTableProps = {
  accountId?: string;
  indexedAccountId?: string;
  protocol: IDeFiProtocol;
  position: ILocalizedProtocolPositionItem;
  actionPosition: IDeFiProtocol['positions'][number];
  currencySymbol: string;
  priceUnavailableLabel: string;
  supportedActions: IDeFiSupportedProtocolAction[];
  onActionSuccess?: (
    params: IProtocolPositionActionSuccessParams,
  ) => void | Promise<void>;
};

const ProtocolSectionedPositionTable = memo(
  ({
    accountId,
    indexedAccountId,
    protocol,
    position,
    actionPosition,
    currencySymbol,
    priceUnavailableLabel,
    supportedActions,
    onActionSuccess,
  }: IProtocolSectionedPositionTableProps) => {
    const intl = useIntl();
    const labels = useMemo(
      () => ({
        position: intl.formatMessage({ id: ETranslations.earn_positions }),
        balance: intl.formatMessage({ id: ETranslations.global_balance }),
        value: intl.formatMessage({ id: ETranslations.global_value }),
      }),
      [intl],
    );

    const sections = position.sections.filter((s) => s.assets.length > 0);

    return (
      <YStack>
        {sections.map((section, sectionIndex) => {
          const actionPlacement = getTableSectionActionPlacement(
            section.assetType,
          );

          return (
            <Fragment key={section.key}>
              <XStack
                mx="$5"
                px="$2"
                py="$2"
                mt={sectionIndex === 0 ? '$0' : '$2'}
                alignItems="center"
                bg="$bgSubdued"
                gap={PROTOCOL_TABLE_COLUMN_GAP}
              >
                <Stack
                  width={POSITION_COLUMN_WIDTH}
                  flexShrink={0}
                  minWidth={0}
                >
                  <SizableText size="$bodySmMedium" color="$textSubdued">
                    {section.assetType === 'supplied'
                      ? labels.position
                      : section.title}
                  </SizableText>
                </Stack>
                <Stack
                  flex={BALANCE_FLEX_WITHOUT_REWARDS}
                  flexBasis={0}
                  minWidth={0}
                >
                  <SizableText size="$bodySmMedium" color="$textSubdued">
                    {labels.balance}
                  </SizableText>
                </Stack>
                <Stack
                  flex={USD_FLEX_WITHOUT_REWARDS}
                  flexBasis={0}
                  minWidth={0}
                  alignItems="flex-end"
                >
                  <SizableText size="$bodySmMedium" color="$textSubdued">
                    {labels.value}
                  </SizableText>
                </Stack>
              </XStack>
              {section.assets.map((asset, assetIndex) => (
                <XStack
                  key={`${section.key}-${asset.address}-${assetIndex}`}
                  mx="$5"
                  px="$2"
                  py="$2"
                  alignItems="center"
                  minHeight={44}
                  gap={PROTOCOL_TABLE_COLUMN_GAP}
                >
                  <XStack
                    width={POSITION_COLUMN_WIDTH}
                    flexShrink={0}
                    minWidth={0}
                    alignItems="center"
                    gap="$2"
                  >
                    <Token
                      size="xs"
                      tokenImageUri={asset.meta?.logoUrl}
                      bg="$bgStrong"
                    />
                    <SizableText
                      size="$bodyMdMedium"
                      numberOfLines={1}
                      flex={1}
                      minWidth={0}
                    >
                      {asset.symbol}
                    </SizableText>
                  </XStack>
                  <Stack
                    flex={BALANCE_FLEX_WITHOUT_REWARDS}
                    flexBasis={0}
                    minWidth={0}
                  >
                    <ProtocolAssetBalanceText
                      asset={asset}
                      currencySymbol={currencySymbol}
                      priceUnavailableLabel={priceUnavailableLabel}
                    />
                    {actionPlacement ? (
                      <ProtocolPositionActionButton
                        accountId={accountId}
                        indexedAccountId={indexedAccountId}
                        protocol={protocol}
                        position={actionPosition}
                        supportedActions={supportedActions}
                        placement={actionPlacement}
                        manageAsset={asset}
                        visualVariant="info"
                        containerProps={ACTION_BUTTON_CONTAINER_PROPS}
                        onSuccess={onActionSuccess}
                      />
                    ) : null}
                  </Stack>
                  <Stack
                    flex={USD_FLEX_WITHOUT_REWARDS}
                    flexBasis={0}
                    minWidth={0}
                    alignItems="flex-end"
                  >
                    <ProtocolValueCell
                      value={asset.value}
                      currencySymbol={currencySymbol}
                      priceUnavailableLabel={priceUnavailableLabel}
                      isUnavailable={isProtocolAssetValueUnavailable(asset)}
                      size="$bodyMdMedium"
                      textAlign="right"
                      numberOfLines={1}
                      fontVariant={TABULAR_NUMS}
                    />
                  </Stack>
                </XStack>
              ))}
            </Fragment>
          );
        })}
      </YStack>
    );
  },
);

ProtocolSectionedPositionTable.displayName = 'ProtocolSectionedPositionTable';

export { ProtocolSectionedPositionTable };
