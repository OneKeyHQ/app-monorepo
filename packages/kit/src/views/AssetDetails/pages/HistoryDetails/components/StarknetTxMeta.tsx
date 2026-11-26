import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Icon,
  NumberSizeableText,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AddressInfo } from '@onekeyhq/kit/src/components/AddressInfo';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { readStarknetPrivacyBlock } from '@onekeyhq/kit/src/views/StarknetPrivacy/utils/starknetPrivacyUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IOnChainHistoryTx } from '@onekeyhq/shared/types/history';
import type { IDecodedTx } from '@onekeyhq/shared/types/tx';

import { InfoItem } from './TxDetailsInfoItem';

function StarknetAttributes({
  decodedTx,
}: {
  decodedTx: IDecodedTx;
  txDetails?: IOnChainHistoryTx;
}) {
  const intl = useIntl();
  const privacy = readStarknetPrivacyBlock(decodedTx.extraInfo);
  const shouldResolve =
    privacy?.kind === 'transfer' && !decodedTx.actions[0]?.assetTransfer;

  const { result: decryptedTx } = usePromiseResult(async () => {
    if (!shouldResolve) return undefined;
    return backgroundApiProxy.serviceStarknetPrivacy
      .resolvePrivateHistoryTx({
        networkId: decodedTx.networkId,
        accountId: decodedTx.accountId,
        txid: decodedTx.txid,
      })
      .catch(() => undefined);
  }, [shouldResolve, decodedTx.networkId, decodedTx.accountId, decodedTx.txid]);

  if (!shouldResolve) {
    return null;
  }

  const assetTransfer = decryptedTx?.decodedTx.actions[0]?.assetTransfer;
  const sendTransfer = assetTransfer?.sends?.[0];
  const receiveTransfer = assetTransfer?.receives?.[0];
  const primaryTransfer = sendTransfer ?? receiveTransfer;

  if (!primaryTransfer) {
    return null;
  }

  const isReceive = !sendTransfer && Boolean(receiveTransfer);
  const fromAddress =
    primaryTransfer.from ??
    assetTransfer?.from ??
    decryptedTx?.decodedTx.signer;
  const toAddress = primaryTransfer.to ?? assetTransfer?.to;

  return (
    <Stack flex={1} flexBasis="100%" p="$2.5">
      <YStack
        bg="$bgSubdued"
        borderRadius="$3"
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="$borderSubdued"
        p="$3"
        gap="$2"
      >
        <XStack alignItems="center" gap="$1.5">
          <Icon name="LockOutline" size="$4" color="$iconSubdued" />
          <SizableText size="$bodyMdMedium" color="$text">
            {intl.formatMessage({
              id: ETranslations.private_send_private_option,
            })}
          </SizableText>
        </XStack>

        <YStack gap="$1">
          <InfoItem
            p="$0"
            label={intl.formatMessage({ id: ETranslations.content__amount })}
            renderContent={
              <NumberSizeableText
                formatter="balance"
                size="$bodyMdMedium"
                color={isReceive ? '$textSuccess' : '$text'}
                formatterOptions={{
                  tokenSymbol: primaryTransfer.symbol,
                  showPlusMinusSigns: true,
                }}
              >
                {`${isReceive ? '+' : '-'}${primaryTransfer.amount}`}
              </NumberSizeableText>
            }
          />
          {fromAddress ? (
            <InfoItem
              p="$0"
              label={intl.formatMessage({ id: ETranslations.global_from })}
              renderContent={fromAddress}
              showCopy
              description={
                <AddressInfo
                  address={fromAddress}
                  networkId={decodedTx.networkId}
                  accountId={decodedTx.accountId}
                />
              }
            />
          ) : null}
          {toAddress ? (
            <InfoItem
              p="$0"
              label={intl.formatMessage({ id: ETranslations.global_to })}
              renderContent={toAddress}
              showCopy
              description={
                <AddressInfo
                  address={toAddress}
                  networkId={decodedTx.networkId}
                  accountId={decodedTx.accountId}
                />
              }
            />
          ) : null}
        </YStack>
      </YStack>
    </Stack>
  );
}

export { StarknetAttributes };
