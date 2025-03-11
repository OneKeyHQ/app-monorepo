import { memo } from 'react';

import { useIntl } from 'react-intl';

import {
  HeaderButtonGroup,
  HeaderIconButton,
  Image,
  Popover,
  SizableText,
  Skeleton,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IDecodedTx } from '@onekeyhq/shared/types/tx';

function TxConfirmHeaderRight(props: { decodedTxs: IDecodedTx[] | undefined }) {
  const { decodedTxs } = props;
  const intl = useIntl();
  const { gtMd } = useMedia();

  const decodedTx = decodedTxs?.[0];

  const mevProtectionProvider = decodedTx?.txDisplay?.mevProtectionProvider;

  if (!mevProtectionProvider) return null;

  return (
    <HeaderButtonGroup>
      <Popover
        title={intl.formatMessage({ id: ETranslations.mev_protection_label })}
        renderTrigger={<HeaderIconButton icon="ShieldCheckDoneOutline" />}
        renderContent={
          <YStack p="$5" pt={gtMd ? '$5' : '$0'} gap="$5">
            <SizableText size="$bodyLg">
              {intl.formatMessage({ id: ETranslations.mev_protection_desc })}
            </SizableText>
            <YStack gap="$2">
              <SizableText size="$bodyLg">
                {intl.formatMessage({ id: ETranslations.global_power_by })}
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
            <SizableText size="$bodyMd" fontStyle="italic" color="$textSubdued">
              {intl.formatMessage({ id: ETranslations.mev_protection_note })}
            </SizableText>
          </YStack>
        }
      />
    </HeaderButtonGroup>
  );
}

export default memo(TxConfirmHeaderRight);
