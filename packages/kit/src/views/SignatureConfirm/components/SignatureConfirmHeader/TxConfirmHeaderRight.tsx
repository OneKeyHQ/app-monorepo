import { memo, useEffect, useMemo, useState } from 'react';

import { find } from 'lodash';
import { useIntl } from 'react-intl';
import { Image as RNImage } from 'react-native';

import {
  Button,
  HeaderButtonGroup,
  Image,
  Popover,
  SizableText,
  Skeleton,
  YStack,
  useMedia,
  useThemeName,
} from '@onekeyhq/components';
import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import { getNetworksSupportMevProtection } from '@onekeyhq/shared/src/config/presetNetworks';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IDecodedTx } from '@onekeyhq/shared/types/tx';

const mevProtectionProviders = getNetworksSupportMevProtection();

const DEFAULT_IMAGE_HEIGHT = 40;

function TxConfirmHeaderRight(props: {
  decodedTxs: IDecodedTx[] | undefined;
  unsignedTxs: IUnsignedTxPro[] | undefined;
}) {
  const { decodedTxs, unsignedTxs } = props;
  const intl = useIntl();
  const { gtMd } = useMedia();
  const theme = useThemeName();

  const decodedTx = decodedTxs?.[0];

  const mevProtectionProvider = useMemo(() => {
    if (!unsignedTxs) return null;

    const unsignedTx = unsignedTxs[0];

    if (unsignedTx.disableMev) {
      return null;
    }

    if (decodedTx?.txDisplay?.mevProtectionProvider) {
      return decodedTx.txDisplay.mevProtectionProvider;
    }

    const swapTx = find(unsignedTxs, 'swapInfo');

    if (swapTx && swapTx.swapInfo) {
      let isBridge = false;

      try {
        isBridge =
          swapTx.swapInfo.sender.accountInfo.networkId !==
          swapTx.swapInfo.receiver.accountInfo.networkId;
      } catch (e) {
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
  }, [unsignedTxs, decodedTx?.txDisplay?.mevProtectionProvider]);

  const imageUri = useMemo(() => {
    if (!mevProtectionProvider) {
      return '';
    }
    return theme === 'dark'
      ? mevProtectionProvider?.logoURIDark || mevProtectionProvider?.logoURI
      : mevProtectionProvider?.logoURI;
  }, [mevProtectionProvider, theme]);

  const [providerImageSize, setProviderImageSize] = useState<
    | {
        width: number;
        height: number;
      }
    | undefined
  >(undefined);

  useEffect(() => {
    if (imageUri) {
      void Image.loadImage({ uri: imageUri }).then((imageRef) => {
        if (imageRef) {
          setProviderImageSize({
            width: imageRef.width,
            height: imageRef.height,
          });
        }
      });
    }
  }, [imageUri]);

  if (!mevProtectionProvider) {
    return null;
  }

  const ratio = providerImageSize
    ? DEFAULT_IMAGE_HEIGHT / providerImageSize.height
    : 1;

  return (
    <HeaderButtonGroup>
      <Popover
        title={intl.formatMessage({ id: ETranslations.mev_protection_label })}
        renderTrigger={
          <Button
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
                {providerImageSize ? (
                  <Image
                    width={providerImageSize.width * ratio}
                    height={DEFAULT_IMAGE_HEIGHT}
                    resizeMode="contain"
                    source={{
                      uri: imageUri,
                    }}
                  />
                ) : (
                  <Skeleton height={DEFAULT_IMAGE_HEIGHT} width="100%" />
                )}
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
