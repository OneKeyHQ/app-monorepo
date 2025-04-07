import { memo, useMemo } from 'react';

import { find } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Button,
  HeaderButtonGroup,
  HeaderIconButton,
  Image,
  Popover,
  SizableText,
  Skeleton,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import { getNetworksSupportMevProtection } from '@onekeyhq/shared/src/config/presetNetworks';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IDecodedTx } from '@onekeyhq/shared/types/tx';

const mevProtectionProviders = getNetworksSupportMevProtection();

function TxConfirmHeaderRight(props: {
  decodedTxs: IDecodedTx[] | undefined;
  unsignedTxs: IUnsignedTxPro[] | undefined;
}) {
  const { decodedTxs, unsignedTxs } = props;
  const intl = useIntl();
  const { gtMd } = useMedia();

  const decodedTx = decodedTxs?.[0];

  const mevProtectionProvider = useMemo(() => {
    if (!unsignedTxs) return null;

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

  if (!mevProtectionProvider) return null;

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
                  Power by
                </SizableText>
                <Image width={160} height={40}>
                  <Image.Source
                    source={{
                      uri: mevProtectionProvider.logoURI,
                    }}
                  />
                  <Image.Loading>
                    <Skeleton width="100%" height="100%" />
                  </Image.Loading>
                </Image>
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
