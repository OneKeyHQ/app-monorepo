import { memo } from 'react';

import { useIntl } from 'react-intl';

import {
  HeaderButtonGroup,
  HeaderIconButton,
  Image,
  Popover,
  SizableText,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { useDecodedTxsAtom } from '@onekeyhq/kit/src/states/jotai/contexts/signatureConfirm';
import { ETranslations } from '@onekeyhq/shared/src/locale';

function TxConfirmHeaderRight() {
  const intl = useIntl();
  const { gtMd } = useMedia();

  const [{ decodedTxs }] = useDecodedTxsAtom();

  const decodedTx = decodedTxs?.[0];

  const mevProtection = decodedTx?.txDisplay?.mevProtection;

  if (!mevProtection) return null;

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
              <Image maxWidth="$6" maxHeight="$6">
                <Image.Source
                  source={{
                    uri: mevProtection.logoURI,
                  }}
                />
                <Image.Fallback alignItems="center" justifyContent="center">
                  <SizableText size="$headingLg">
                    {mevProtection.name}
                  </SizableText>
                </Image.Fallback>
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
