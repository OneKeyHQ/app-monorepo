import { useCallback } from 'react';

import { useNavigation } from '@react-navigation/native';

import { Dialog, Page, YStack } from '@onekeyhq/components';
import {
  type IPerpsActiveAccountAtom,
  usePerpsActiveAccountAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { PerpsProviderMirror } from '../../../PerpsProviderMirror';

import { DepositWithdrawContent } from './DepositWithdrawModal';

import type { IPerpsDepositWithdrawActionType } from './DepositWithdrawModal';

function showPortfolioSubDialog(
  actionType: IPerpsDepositWithdrawActionType,
  selectedAccount: IPerpsActiveAccountAtom,
) {
  const isDepositRelated =
    actionType === 'depositSelect' ||
    actionType === 'walletDeposit' ||
    actionType === 'relay';

  const getTitle = () => {
    if (actionType === 'withdraw') {
      return appLocale.intl.formatMessage({
        id: ETranslations.perp_trade_withdraw,
      });
    }
    return undefined;
  };

  const dialogInstance = Dialog.show({
    title: getTitle(),
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
      showPortfolioSubDialog(actionType, selectedAccount);
    },
    [selectedAccount],
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
        title={appLocale.intl.formatMessage({
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
