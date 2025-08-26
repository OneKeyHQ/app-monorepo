import { memo, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Page } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalApprovalManagementRoutes,
  IModalApprovalManagementParamList,
} from '@onekeyhq/shared/src/routes/approvalManagement';

import { HomeApprovalListProviderMirror } from '../../Home/components/HomeApprovalListProvider/HomeApprovalListProviderMirror';
import { ApprovalManagementContext } from '../components/ApprovalManagementContext';

import type { RouteProp } from '@react-navigation/core';

function RevokeSuggestion() {
  const intl = useIntl();
  const route =
    useRoute<
      RouteProp<
        IModalApprovalManagementParamList,
        EModalApprovalManagementRoutes.RevokeSuggestion
      >
    >();
  const { approvals, alertType } = route.params;
  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.wallet_revoke_suggestion,
        })}
      />
    </Page>
  );
}

const RevokeSuggestionWithProvider = memo(() => {
  const [isBuildingRevokeTxs, setIsBuildingRevokeTxs] = useState(false);
  const [selectedTokens, setSelectedTokens] = useState<Record<string, boolean>>(
    {},
  );

  const contextValue = useMemo(
    () => ({
      isBuildingRevokeTxs,
      setIsBuildingRevokeTxs,
      selectedTokens,
      setSelectedTokens,
    }),
    [
      isBuildingRevokeTxs,
      setIsBuildingRevokeTxs,
      selectedTokens,
      setSelectedTokens,
    ],
  );
  return (
    <HomeApprovalListProviderMirror>
      <ApprovalManagementContext.Provider value={contextValue}>
        <RevokeSuggestion />
      </ApprovalManagementContext.Provider>
    </HomeApprovalListProviderMirror>
  );
});
RevokeSuggestionWithProvider.displayName = 'RevokeSuggestionWithProvider';

export default RevokeSuggestionWithProvider;
