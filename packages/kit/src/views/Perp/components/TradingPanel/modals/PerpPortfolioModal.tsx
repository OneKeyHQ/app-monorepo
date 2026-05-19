import { useCallback } from 'react';

import { useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Dialog, Page, YStack } from '@onekeyhq/components';
import {
  type IPerpsActiveAccountAtom,
  usePerpsActiveAccountAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IPerpsDepositWithdrawActionType } from '@onekeyhq/shared/types/hyperliquid/routes';

import { PerpsProviderMirror } from '../../../PerpsProviderMirror';

import { DepositWithdrawContent } from './DepositWithdrawModal';

function showPortfolioSubDialog(
  actionType: IPerpsDepositWithdrawActionType,
  selectedAccount: IPerpsActiveAccountAtom,
  title?: string,
) {
  const isDepositRelated =
    actionType === 'depositSelect' ||
    actionType === 'walletDeposit' ||
    actionType === 'relay';

  const dialogInstance = Dialog.show({
    title: actionType === 'withdraw' ? title : undefined,
    showExitButton: !isDepositRelated,
    renderContent: (
      <PerpsProviderMirror>
        <DepositWithdrawContent
          params={{ actionType }}
          selectedAccount={selectedAccount}
          onClose={() => {
            void dialogInstance.close();
          }}
        />
      </PerpsProviderMirror>
    ),
    showFooter: false,
  });
}

function PerpPortfolioModal() {
  const intl = useIntl();
  const navigation = useNavigation();
  const [selectedAccount] = usePerpsActiveAccountAtom();

  const handleClose = useCallback(() => {
    setTimeout(
      () => {
        navigation.goBack();
      },
      platformEnv.isNative ? 350 : 0,
    );
  }, [navigation]);

  const handleNavigate = useCallback(
    (actionType: IPerpsDepositWithdrawActionType) => {
      showPortfolioSubDialog(
        actionType,
        selectedAccount,
        intl.formatMessage({ id: ETranslations.perp_trade_withdraw }),
      );
    },
    [intl, selectedAccount],
  );

  if (!selectedAccount?.accountId || !selectedAccount?.accountAddress) {
    return (
      <Page>
        <Page.Body />
      </Page>
    );
  }

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.perp_trade_account_overview,
        })}
      />
      <Page.Body>
        <PerpsProviderMirror>
          <YStack px="$4" flex={1}>
            <DepositWithdrawContent
              params={{ actionType: 'deposit' }}
              selectedAccount={selectedAccount}
              onClose={handleClose}
              onNavigate={handleNavigate}
            />
          </YStack>
        </PerpsProviderMirror>
      </Page.Body>
    </Page>
  );
}

export default PerpPortfolioModal;
