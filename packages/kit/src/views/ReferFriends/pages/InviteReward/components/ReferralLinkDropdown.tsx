import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  ActionList,
  Button,
  Icon,
  IconButton,
  Stack,
  useClipboard,
  useMedia,
} from '@onekeyhq/components';
import type { IActionListItemProps, IButtonProps } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

interface IReferralLinkDropdownProps {
  inviteUrl: string;
  buttonProps?: IButtonProps;
}

export function ReferralLinkDropdown({
  inviteUrl,
  buttonProps,
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
    () =>
      buttonProps ? (
        <Button variant="secondary" size="small" {...buttonProps}>
          <Icon name="ChevronDownSmallOutline" size="$3" />
        </Button>
      ) : (
        <IconButton
          icon="ChevronDownSmallOutline"
          variant="tertiary"
          size="small"
        />
      ),
    [buttonProps],
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

  if (buttonProps) {
    return (
      <Button
        variant="secondary"
        size="small"
        onPress={handleMobilePress}
        {...buttonProps}
      >
        <Icon name="ChevronDownSmallOutline" size="$3" />
      </Button>
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
