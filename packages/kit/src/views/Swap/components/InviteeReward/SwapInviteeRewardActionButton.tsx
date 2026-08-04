import type { ComponentProps } from 'react';

import { useIntl } from 'react-intl';

import { HeaderIconButton } from '@onekeyhq/components/src/layouts/Navigation/Header';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useShowSwapInviteeReward } from './hooks/useShowSwapInviteeReward';

type ISwapInviteeRewardActionButtonProps = Omit<
  ComponentProps<typeof HeaderIconButton>,
  'accessibilityLabel' | 'onPress' | 'title'
>;

export function useSwapInviteeRewardAction() {
  const intl = useIntl();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const accountId =
    activeAccount.account?.id ?? activeAccount.indexedAccount?.id;
  const { showSwapInviteeReward } = useShowSwapInviteeReward({
    accountId,
    indexedAccountId: activeAccount.indexedAccount?.id,
  });
  const title = intl.formatMessage({
    id: ETranslations.referral_swap_reward,
  });

  return {
    showSwapInviteeReward,
    title,
  };
}

export function SwapInviteeRewardActionButton(
  props: ISwapInviteeRewardActionButtonProps,
) {
  const { showSwapInviteeReward, title } = useSwapInviteeRewardAction();

  return (
    <HeaderIconButton
      {...props}
      title={title}
      accessibilityLabel={title}
      onPress={showSwapInviteeReward}
    />
  );
}
