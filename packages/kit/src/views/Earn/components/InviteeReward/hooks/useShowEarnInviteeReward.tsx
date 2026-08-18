import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, useInTabDialog, useMedia } from '@onekeyhq/components';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { EarnInviteeRewardContent } from '../EarnInviteeRewardContent';

export function useShowEarnInviteeReward() {
  const intl = useIntl();
  const { gtMd } = useMedia();
  const dialogInTab = useInTabDialog();
  const {
    activeAccount: { account, indexedAccount },
  } = useActiveAccount({ num: 0 });

  const showEarnInviteeReward = useCallback(() => {
    const content = (
      <EarnInviteeRewardContent
        accountId={account?.id}
        indexedAccountId={indexedAccount?.id}
      />
    );
    const dialogProps = {
      title: intl.formatMessage({
        id: ETranslations.earn_referral_bonus,
      }),
      floatingPanelProps: {
        width: 480,
      },
      renderContent: content,
      showFooter: false,
    };
    const showAsDialog = !platformEnv.isNative && gtMd;
    if (showAsDialog) {
      dialogInTab.show(dialogProps);
      return;
    }
    Dialog.show(dialogProps);
  }, [account?.id, dialogInTab, gtMd, indexedAccount?.id, intl]);

  return { showEarnInviteeReward };
}
