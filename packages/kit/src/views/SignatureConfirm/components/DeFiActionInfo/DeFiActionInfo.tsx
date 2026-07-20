import { memo, useMemo } from 'react';

import {
  Image,
  NumberSizeableText,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import { TokenGroup } from '@onekeyhq/kit/src/components/Token';
import type { IDeFiActionTxConfirmInfo } from '@onekeyhq/shared/types/defi';

import { SignatureConfirmItem } from '../SignatureConfirmItem';

type IProps = {
  unsignedTxs: IUnsignedTxPro[];
};

function getDeFiActionInfo(
  unsignedTx: IUnsignedTxPro,
): IDeFiActionTxConfirmInfo | undefined {
  return (
    unsignedTx.payload as
      | { defiActionInfo?: IDeFiActionTxConfirmInfo }
      | undefined
  )?.defiActionInfo;
}

function DeFiActionInfo(props: IProps) {
  const { unsignedTxs } = props;
  const actionInfos = useMemo(
    () =>
      unsignedTxs
        .map(getDeFiActionInfo)
        .filter((info): info is IDeFiActionTxConfirmInfo => Boolean(info)),
    [unsignedTxs],
  );

  if (actionInfos.length === 0) {
    return null;
  }

  return (
    <XStack m="$-2.5" flexWrap="wrap" testID="defi-action-info">
      {actionInfos.map((info, index) => (
        <SignatureConfirmItem
          // eslint-disable-next-line react/no-array-index-key
          key={`${info.protocolId}-${info.assetSymbol}-${index}`}
          compact
          p="$2.5"
        >
          <SignatureConfirmItem.Label>
            {info.actionLabel}
          </SignatureConfirmItem.Label>
          <XStack alignItems="center" gap="$2" flex={1} minWidth={0}>
            {info.assetLogoUrls?.length ? (
              <TokenGroup
                tokens={info.assetLogoUrls.map((logoUrl) => ({
                  tokenImageUri: logoUrl,
                }))}
                size="xs"
                variant="overlapped"
                wrapperStyle="border"
                wrapperBorderColor="$bgSubdued"
              />
            ) : null}
            {!info.assetLogoUrls?.length && info.assetLogoUrl ? (
              <Image
                borderRadius="$1"
                w="$5"
                h="$5"
                source={{ uri: info.assetLogoUrl }}
              />
            ) : null}
            <YStack minWidth={0} flex={1} gap="$0.5">
              <XStack alignItems="center" gap="$1" minWidth={0}>
                {info.assetAmount ? (
                  <NumberSizeableText
                    size="$bodyMd"
                    formatter="balance"
                    numberOfLines={1}
                  >
                    {info.assetAmount}
                  </NumberSizeableText>
                ) : null}
                <SizableText size="$bodyMd" numberOfLines={1} flexShrink={1}>
                  {info.assetSymbol}
                </SizableText>
              </XStack>
              {info.extraLabel ? (
                <SizableText
                  size="$bodySm"
                  color="$textSubdued"
                  numberOfLines={1}
                >
                  {info.extraLabel}
                </SizableText>
              ) : null}
            </YStack>
          </XStack>
        </SignatureConfirmItem>
      ))}
    </XStack>
  );
}

export default memo(DeFiActionInfo);
