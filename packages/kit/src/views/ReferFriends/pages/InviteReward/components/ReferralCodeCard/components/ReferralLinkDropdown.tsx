import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  ActionList,
  IconButton,
  Stack,
  useClipboard,
  useMedia,
} from '@onekeyhq/components';
import type { IActionListItemProps } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

interface IReferralLinkDropdownProps {
  inviteUrl: string;
}

export function ReferralLinkDropdown({
  inviteUrl,
}: IReferralLinkDropdownProps) {
  const intl = useIntl();
  const { copyText } = useClipboard();
  const { gtMd } = useMedia();

  const walletInviteUrl = useMemo(() => `${inviteUrl}/app`, [inviteUrl]);
  const shopInviteUrl = useMemo(() => `${inviteUrl}/shop`, [inviteUrl]);

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
      <IconButton
        icon="ChevronDownSmallOutline"
        variant="tertiary"
        size="small"
      />
    ),
    [],
  );

  const handleStopPropagation = useCallback(
    (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
    },
    [],
  );

  if (gtMd) {
    return (
      <Stack onPress={handleStopPropagation}>
        <ActionList title={title} renderTrigger={renderTrigger} items={items} />
      </Stack>
    );
  }

  return (
    <IconButton
      icon="ChevronDownSmallOutline"
      variant="tertiary"
      size="small"
      onPress={handleMobilePress}
    />
  );
}
