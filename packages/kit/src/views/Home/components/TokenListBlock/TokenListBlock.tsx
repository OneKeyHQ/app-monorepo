import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  IconButton,
  NumberSizeableText,
  SizableText,
  XStack,
  useMedia,
} from '@onekeyhq/components';
import { useManageToken } from '@onekeyhq/kit/src/hooks/useManageToken';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { RichBlock } from '../RichBlock/RichBlock';

function TokenListBlock() {
  const intl = useIntl();

  const [settings] = useSettingsPersistAtom();

  const media = useMedia();

  const {
    activeAccount: {
      account,
      network,
      wallet,
      indexedAccount,
      isOthersWallet,
      deriveType,
    },
  } = useActiveAccount({ num: 0 });

  const { handleOnManageToken, manageTokenEnabled } = useManageToken({
    accountId: account?.id ?? '',
    networkId: network?.id ?? '',
    walletId: wallet?.id ?? '',
    deriveType,
    indexedAccountId: indexedAccount?.id,
    isOthersWallet,
  });

  const renderTitle = useCallback(() => {
    if (media.gtMd) {
      return (
        <XStack alignItems="center" gap="$1">
          <SizableText size="$headingLg">
            {intl.formatMessage({
              id: ETranslations.global_universal_search_tabs_tokens,
            })}
          </SizableText>
          <SizableText size="$headingLg" color="$textSubdued">
            ·
          </SizableText>
          <NumberSizeableText
            size="$headingXl"
            color="$textSubdued"
            formatter="value"
            formatterOptions={{
              currency: settings.currencyInfo.symbol,
            }}
          >
            123
          </NumberSizeableText>
        </XStack>
      );
    }

    return (
      <SizableText size="$bodyLgMedium">
        {intl.formatMessage({
          id: ETranslations.global_universal_search_tabs_tokens,
        })}
      </SizableText>
    );
  }, [intl, media.gtMd, settings.currencyInfo.symbol]);

  const renderHeaderActions = useCallback(() => {
    if (manageTokenEnabled && media.gtMd) {
      return (
        <IconButton
          title={intl.formatMessage({
            id: ETranslations.manage_token_title,
          })}
          variant="tertiary"
          icon="SliderHorOutline"
          onPress={handleOnManageToken}
          size="small"
        />
      );
    }

    return null;
  }, [media.gtMd, intl, manageTokenEnabled, handleOnManageToken]);

  return (
    <RichBlock title={renderTitle()} headerActions={renderHeaderActions()} />
  );
}

export { TokenListBlock };
