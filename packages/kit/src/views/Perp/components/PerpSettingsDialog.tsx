import type { ReactNode } from 'react';
import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  ESwitchSize,
  Icon,
  Popover,
  Skeleton,
  Switch,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useCheckWalletReferralCodeBound } from '@onekeyhq/kit/src/views/ReferFriends/hooks/useCheckWalletReferralCodeBound';
import {
  usePerpsActiveAccountAtom,
  usePerpsCustomSettingsAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { PerpsProviderMirror } from '../PerpsProviderMirror';

import { useShowInviteeRewardModal } from './InviteeReward/hooks/useShowInviteeRewardModal';

interface IPerpSettingsPopoverContentProps {
  closePopover: () => void;
}

function PerpSettingsPopoverContent({
  closePopover,
}: IPerpSettingsPopoverContentProps) {
  const [perpsCustomSettings, setPerpsCustomSettings] =
    usePerpsCustomSettingsAtom();
  const intl = useIntl();
  const { showInviteeRewardModal } = useShowInviteeRewardModal();
  const [selectedAccount] = usePerpsActiveAccountAtom();

  const walletId = useMemo(() => {
    if (!selectedAccount?.accountId) return undefined;
    return accountUtils.getWalletIdFromAccountId({
      accountId: selectedAccount.accountId,
    });
  }, [selectedAccount?.accountId]);

  const {
    shouldBoundReferralCode,
    isLoadingReferralCodeButton,
    isWalletSupported,
  } = useCheckWalletReferralCodeBound({
    walletId,
  });

  let referralBadge: React.ReactNode = null;

  if (isLoadingReferralCodeButton) {
    referralBadge = <Skeleton w="$12" h="$5" />;
  } else if (!shouldBoundReferralCode && walletId) {
    // Show badge only when wallet is already bound
    referralBadge = (
      <Badge badgeSize="sm" badgeType="info">
        <Badge.Text>
          {intl.formatMessage({
            id: ETranslations.referral_wallet_bind_code_finish,
          })}
        </Badge.Text>
      </Badge>
    );
  }

  return (
    <YStack py="$3" px="$4" gap="$3">
      <ListItem
        mx="$0"
        p="$0"
        titleProps={{ size: '$bodyMdMedium' }}
        subtitleProps={{ size: '$bodySm' }}
        title={intl.formatMessage({
          id: ETranslations.perp_setting_title,
        })}
        subtitle={intl.formatMessage({
          id: ETranslations.perp_setting_desc,
        })}
      >
        <Switch
          size={ESwitchSize.small}
          value={perpsCustomSettings.skipOrderConfirm}
          onChange={(value) => {
            setPerpsCustomSettings((prev) => ({
              ...prev,
              skipOrderConfirm: value,
            }));
          }}
        />
      </ListItem>
      {/* Only show referral menu item if wallet type is supported */}
      {isWalletSupported ? (
        <ListItem
          cursor="pointer"
          mx="$0"
          p="$0"
          titleProps={{ size: '$bodyMdMedium' }}
          title={intl.formatMessage({
            id: ETranslations.perps_trade_reward,
          })}
          subtitleProps={{ size: '$bodySm' }}
          subtitle={intl.formatMessage({
            id: ETranslations.Perps_referral_bonus_from,
          })}
          onPress={() => {
            closePopover();
            void showInviteeRewardModal();
          }}
          hoverStyle={{}}
          pressStyle={{}}
        >
          <XStack gap="$2" alignItems="center">
            {referralBadge}
            <Icon name="ChevronRightOutline" size="$4" color="$iconSubdued" />
          </XStack>
        </ListItem>
      ) : null}
    </YStack>
  );
}

export interface IPerpSettingsPopoverProps {
  renderTrigger: ReactNode;
}

export function PerpSettingsPopover({
  renderTrigger,
}: IPerpSettingsPopoverProps) {
  const intl = useIntl();

  return (
    <PerpsProviderMirror>
      <Popover
        title={intl.formatMessage({ id: ETranslations.global_settings })}
        renderTrigger={renderTrigger}
        renderContent={({ closePopover }) => (
          <PerpSettingsPopoverContent closePopover={closePopover} />
        )}
        floatingPanelProps={{
          width: 360,
        }}
      />
    </PerpsProviderMirror>
  );
}
