import { useIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useEtherFiLegacyApproval } from './useEtherFiLegacyApproval';

import type { IEarnActionGuard } from './useEarnActionGuard';

export function useEtherFiLegacyActionGuard({
  accountId,
  accountAddress,
  networkId,
  vault,
  onCleared,
  skip,
}: {
  accountId: string;
  accountAddress?: string;
  networkId: string;
  vault?: string;
  onCleared?: () => void;
  skip?: boolean;
}): IEarnActionGuard {
  const intl = useIntl();
  const approval = useEtherFiLegacyApproval({
    accountId,
    accountAddress,
    networkId,
    provider: 'etherfi',
    vault,
    onCleared,
    skip,
  });

  let action: IEarnActionGuard['action'];
  if (approval.status === 'required') {
    action = {
      text: intl.formatMessage(
        { id: ETranslations.global_revoke_approve },
        { symbol: 'liquidUSD' },
      ),
      onPress: () => void approval.revoke(),
    };
  } else if (approval.status === 'pending' || approval.status === 'unknown') {
    const id =
      approval.status === 'pending'
        ? ETranslations.global_pending
        : ETranslations.global_an_error_occurred;
    action = {
      text: intl.formatMessage({
        id:
          approval.status === 'pending'
            ? ETranslations.global_pending
            : ETranslations.global_retry,
      }),
      onPress: () => {
        Toast.message({ title: intl.formatMessage({ id }) });
        void approval.refresh();
      },
    };
  }

  return {
    action,
    loading: approval.status === 'checking' || approval.status === 'submitting',
    blocked: approval.blocked,
    verifyBeforeAction: approval.verifyBeforeAction,
    isActionAllowed: approval.isActionAllowed,
  };
}
