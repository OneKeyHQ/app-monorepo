import { memo, useCallback, useMemo, useState } from 'react';

import { find } from 'lodash';
import { useIntl } from 'react-intl';

import type { IImageProps } from '@onekeyhq/components';
import {
  Button,
  HeaderButtonGroup,
  Image,
  Popover,
  SizableText,
  YStack,
  useMedia,
  useThemeName,
} from '@onekeyhq/components';
import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import { getNetworksSupportMevProtection } from '@onekeyhq/shared/src/config/presetNetworks';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IGasPayer } from '@onekeyhq/shared/types/fee';
import { privateSendProvider } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import { EProtocolOfExchange } from '@onekeyhq/shared/types/swap/types';
import type { IDecodedTx } from '@onekeyhq/shared/types/tx';

const mevProtectionProviders = getNetworksSupportMevProtection();

const DEFAULT_IMAGE_HEIGHT = 40;

function isPrivateSendSwapInfo(swapInfo: IUnsignedTxPro['swapInfo']) {
  const buildResult = swapInfo?.swapBuildResData?.result;
  return (
    swapInfo?.protocol === EProtocolOfExchange.PRIVATE_SEND ||
    buildResult?.protocol === EProtocolOfExchange.PRIVATE_SEND ||
    buildResult?.info?.provider === privateSendProvider
  );
}

export type ITxConfirmHeaderRightProps = {
  decodedTxs: IDecodedTx[] | undefined;
  unsignedTxs: IUnsignedTxPro[] | undefined;
  effectiveFeePayer?: IGasPayer;
  txFeeInfoInit?: boolean;
};

export function getTxConfirmMevProtectionProvider({
  decodedTxs,
  unsignedTxs,
  effectiveFeePayer,
  txFeeInfoInit,
}: ITxConfirmHeaderRightProps) {
  const decodedTx = decodedTxs?.[0];

  if (!unsignedTxs) return null;

  // Wait until fee info is initialized before deciding on the badge.
  // `effectiveFeePayer` defaults to `'user'` and is only updated once the
  // async fee estimation completes, so rendering the badge earlier would
  // briefly show MEV for sponsored txs (and could leak the previous tx's
  // payer in queue mode). Hiding it until init avoids that flicker.
  if (!txFeeInfoInit) {
    return null;
  }

  // Hide the MEV badge whenever the fee is sponsored (gas account or BNB
  // gas-free / megafuel). Sponsored transactions are relayed through a
  // sponsor-bound RPC rather than the MEV-protected RPC, so the badge would
  // be misleading. Only user-paid transactions go through the MEV-protected
  // RPC and keep the badge.
  if (effectiveFeePayer === 'gasAccount' || effectiveFeePayer === 'megafuel') {
    return null;
  }

  const unsignedTx = unsignedTxs[0];
  if (!unsignedTx) {
    return null;
  }

  const swapTx = find(unsignedTxs, 'swapInfo');

  if (
    decodedTx?.payload?.privateSend ||
    isPrivateSendSwapInfo(swapTx?.swapInfo)
  ) {
    return null;
  }

  if (unsignedTx.disableMev) {
    return null;
  }

  if (decodedTx?.txDisplay?.mevProtectionProvider) {
    return decodedTx.txDisplay.mevProtectionProvider;
  }

  if (swapTx && swapTx.swapInfo) {
    let isBridge = false;

    try {
      isBridge =
        swapTx.swapInfo.sender.accountInfo.networkId !==
        swapTx.swapInfo.receiver.accountInfo.networkId;
    } catch (_e) {
      isBridge = false;
    }

    if (
      !isBridge &&
      mevProtectionProviders[swapTx.swapInfo.receiver.accountInfo.networkId]
    ) {
      return mevProtectionProviders[
        swapTx.swapInfo.receiver.accountInfo.networkId
      ];
    }
  }

  return null;
}

function TxConfirmHeaderRight(props: ITxConfirmHeaderRightProps) {
  const { decodedTxs, unsignedTxs, effectiveFeePayer, txFeeInfoInit } = props;
  const intl = useIntl();
  const { gtMd } = useMedia();
  const theme = useThemeName();

  const mevProtectionProvider = useMemo(
    () =>
      getTxConfirmMevProtectionProvider({
        decodedTxs,
        unsignedTxs,
        effectiveFeePayer,
        txFeeInfoInit,
      }),
    [decodedTxs, unsignedTxs, effectiveFeePayer, txFeeInfoInit],
  );

  const imageUri = useMemo(() => {
    if (!mevProtectionProvider) {
      return '';
    }
    return theme === 'dark'
      ? mevProtectionProvider?.logoURIDark || mevProtectionProvider?.logoURI
      : mevProtectionProvider?.logoURI;
  }, [mevProtectionProvider, theme]);

  const [providerImageInfo, setProviderImageInfo] = useState<
    | {
        uri: string;
        width: number;
        height: number;
      }
    | undefined
  >(undefined);

  const handleProviderImageLoad = useCallback(
    ({ source }: Parameters<NonNullable<IImageProps['onLoad']>>[0]) => {
      setProviderImageInfo({
        uri: imageUri,
        width: source.width,
        height: source.height,
      });
    },
    [imageUri],
  );

  const providerImageSize =
    providerImageInfo?.uri === imageUri ? providerImageInfo : undefined;

  const providerImageWidth = providerImageSize
    ? (DEFAULT_IMAGE_HEIGHT / providerImageSize.height) *
      providerImageSize.width
    : DEFAULT_IMAGE_HEIGHT;

  if (!mevProtectionProvider) {
    return null;
  }

  return (
    <HeaderButtonGroup>
      <Popover
        title={intl.formatMessage({ id: ETranslations.mev_protection_label })}
        renderTrigger={
          <Button
            testID="signature-confirm-ratio-btn"
            variant="tertiary"
            icon="ShieldCheckDoneSolid"
            iconColor="$iconSuccess"
            size="medium"
          >
            MEV
          </Button>
        }
        renderContent={
          <YStack p="$5" pt={gtMd ? '$5' : '$0'} gap="$2">
            {gtMd ? (
              <SizableText size="$headingMd">
                {intl.formatMessage({ id: ETranslations.mev_protection_label })}
              </SizableText>
            ) : null}
            <YStack gap="$5">
              <SizableText size={gtMd ? '$bodyMd' : '$bodyLg'}>
                {intl.formatMessage({ id: ETranslations.mev_protection_desc })}
              </SizableText>
              <YStack gap="$2">
                <SizableText size={gtMd ? '$bodyMd' : '$bodyLg'}>
                  {intl.formatMessage({ id: ETranslations.global_power_by })}
                </SizableText>
                <Image
                  width={providerImageWidth}
                  height={DEFAULT_IMAGE_HEIGHT}
                  resizeMode="contain"
                  recyclingKey={imageUri}
                  source={{
                    uri: imageUri,
                  }}
                  onLoad={handleProviderImageLoad}
                />
              </YStack>
              <SizableText
                size="$bodyMd"
                fontStyle="italic"
                color="$textSubdued"
                style={{
                  fontStyle: 'italic',
                }}
              >
                {`*${intl.formatMessage({
                  id: ETranslations.mev_protection_note,
                })}`}
              </SizableText>
            </YStack>
          </YStack>
        }
      />
    </HeaderButtonGroup>
  );
}

export default memo(TxConfirmHeaderRight);
