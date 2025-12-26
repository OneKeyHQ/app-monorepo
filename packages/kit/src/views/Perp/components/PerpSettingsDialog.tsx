import type { ReactNode } from 'react';
import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  Button,
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
  DEFAULT_PERPS_LAYOUT_STATE,
  usePerpsActiveAccountAtom,
  usePerpsCustomSettingsAtom,
  usePerpsLayoutStateAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { PerpsProviderMirror } from '../PerpsProviderMirror';

import { useShowInviteeRewardModal } from './InviteeReward/hooks/useShowInviteeRewardModal';

interface IPerpSettingsPopoverContentProps {
  closePopover: () => void;
}

const SHOW_RESET_LAYOUT =
  platformEnv.isWeb ||
  platformEnv.isDesktop ||
  platformEnv.isExtensionUiExpandTab;

function PerpSettingsPopoverContent({
  closePopover,
}: IPerpSettingsPopoverContentProps) {
  const [perpsCustomSettings, setPerpsCustomSettings] =
    usePerpsCustomSettingsAtom();
  const [, setPerpsLayoutState] = usePerpsLayoutStateAtom();
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
    <YStack py="$3" px="$2">
      <ListItem
        mx="$0"
        px="$2.5"
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
          cursor="pointer"
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
          px="$2.5"
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
        >
          <XStack gap="$2" alignItems="center">
            {referralBadge}
            <Icon name="ChevronRightOutline" size="$4" color="$iconSubdued" />
          </XStack>
        </ListItem>
      ) : null}
      {SHOW_RESET_LAYOUT ? (
        <ListItem
          cursor="pointer"
          mx="$0"
          px="$2.5"
          title={intl.formatMessage({
            id: ETranslations.perps_settings_return_to_default_layout,
          })}
          titleProps={{ size: '$bodyMdMedium' }}
          onPress={() => {
            setPerpsLayoutState({
              ...DEFAULT_PERPS_LAYOUT_STATE,
              resetAt: Date.now(),
            });
            closePopover();
          }}
        />
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
