import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  ActionList,
  Divider,
  Icon,
  SizableText,
  Stack,
  XStack,
  useClipboard,
  useMedia,
} from '@onekeyhq/components';
import type { IActionListItemProps } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

interface ICopyLinkSplitButtonProps {
  url: string;
}

export function CopyLinkSplitButton({ url }: ICopyLinkSplitButtonProps) {
  const intl = useIntl();
  const { copyText } = useClipboard();
  const { gtMd } = useMedia();

  const walletInviteUrl = useMemo(() => `${url}/app`, [url]);
  const shopInviteUrl = useMemo(() => `${url}/shop`, [url]);

  const handleCopy = useCallback(() => {
    void copyText(url);
    defaultLogger.referral.page.shareReferralLink('copy');
  }, [url, copyText]);

  const handleCopyWalletLink = useCallback(() => {
    copyText(walletInviteUrl);
    defaultLogger.referral.page.shareReferralLink('copy');
  }, [copyText, walletInviteUrl]);

  const handleCopyShopLink = useCallback(() => {
    copyText(shopInviteUrl);
    defaultLogger.referral.page.shareReferralLink('copy');
  }, [copyText, shopInviteUrl]);

  const title = intl.formatMessage({
    id: ETranslations.referral_referral_link,
  });

  const items = useMemo<IActionListItemProps[]>(
    () => [
      {
        label: intl.formatMessage({
          id: ETranslations.referral_copy_link_wallet,
        }),
        onPress: handleCopyWalletLink,
      },
      {
        label: intl.formatMessage({
          id: ETranslations.referral_copy_link_shop,
        }),
        onPress: handleCopyShopLink,
      },
    ],
    [intl, handleCopyWalletLink, handleCopyShopLink],
  );

  const handleMobilePress = useCallback(
    (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      ActionList.show({
        title,
        items,
      });
    },
    [title, items],
  );

  const renderTrigger = useMemo(
    () => (
      <Stack px="$2" py="$1.5">
        <Icon name="ChevronDownSmallOutline" size="$4" color="$icon" />
      </Stack>
    ),
    [],
  );

  const handleStopPropagation = useCallback(
    (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
    },
    [],
  );

  return (
    <XStack bg="$bgStrong" borderRadius="$2" overflow="hidden" ai="center">
      <Stack
        px="$2.5"
        py="$1.5"
        onPress={handleCopy}
        hoverStyle={{ bg: '$bgHover' }}
        pressStyle={{ bg: '$bgActive' }}
        cursor="pointer"
      >
        <SizableText size="$bodySm" color="$text">
          {intl.formatMessage({ id: ETranslations.browser_copy_link })}
        </SizableText>
      </Stack>
      <Divider vertical h="$4" />
      {gtMd ? (
        <Stack onPress={handleStopPropagation}>
          <ActionList
            title={title}
            renderTrigger={renderTrigger}
            items={items}
          />
        </Stack>
      ) : (
        <Stack
          px="$2"
          py="$1.5"
          onPress={handleMobilePress}
          hoverStyle={{ bg: '$bgHover' }}
          pressStyle={{ bg: '$bgActive' }}
        >
          <Icon name="ChevronDownSmallOutline" size="$4" color="$icon" />
        </Stack>
      )}
    </XStack>
  );
}
