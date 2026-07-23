import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { ActionList, Toast } from '@onekeyhq/components';
import { useIdentityExitFlow } from '@onekeyhq/kit/src/components/OneKeyAuth/useIdentityExitFlow';
import { useAccountSelectorContextData } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { AccountManagerTestIDs } from '../../testIDs';

import {
  getTitleAndDescription,
  showWalletRemoveDialog,
} from './WalletRemoveDialog';

export function WalletRemoveButton({
  wallet,
  isRemoveToMocked,
  onClose,
}: {
  wallet: IDBWallet | undefined;
  isRemoveToMocked?: boolean; // hw standard wallet mocked remove only
  onClose: () => void;
}) {
  const intl = useIntl();
  const { config } = useAccountSelectorContextData();
  const { run: runIdentityExit } = useIdentityExitFlow();

  const label = useMemo(() => {
    if (platformEnv.isWebDappMode) {
      return intl.formatMessage({ id: ETranslations.explore_disconnect });
    }
    if (wallet?.isKeyless) {
      return intl.formatMessage({ id: ETranslations.log_out_wallet });
    }
    if (accountUtils.isHwHiddenWallet({ wallet })) {
      return intl.formatMessage({ id: ETranslations.remove_hidden_wallet });
    }
    if (accountUtils.isHwOrQrWallet({ walletId: wallet?.id })) {
      if (isRemoveToMocked) {
        return intl.formatMessage({ id: ETranslations.remove_standard_wallet });
      }
      return intl.formatMessage({
        id: ETranslations.remove_device,
      });
    }
    return intl.formatMessage({
      id: ETranslations.remove_wallet,
    });
  }, [isRemoveToMocked, wallet, intl]);

  const icon = useMemo(() => {
    if (wallet?.isKeyless) {
      return 'LogoutOutline';
    }
    if (isRemoveToMocked) {
      return 'DeleteOutline';
    }
    return 'EjectOutline';
  }, [wallet?.isKeyless, isRemoveToMocked]);

  return (
    <ActionList.Item
      testID={AccountManagerTestIDs.walletRemoveButton}
      icon={icon}
      destructive
      label={label}
      onClose={onClose}
      onPress={() => {
        if (wallet?.isKeyless) {
          void runIdentityExit(
            {
              type: 'removeKeyless',
              expectedWalletId: wallet.id,
              scene: 'accountSelector',
            },
            {
              confirmButtonTestID: AccountManagerTestIDs.walletRemoveConfirm,
              onCompletedReceipt: () => {
                defaultLogger.account.wallet.deleteWallet();
                Toast.success({
                  title: intl.formatMessage({
                    id: ETranslations.feedback_change_saved,
                  }),
                });
              },
            },
          );
          return;
        }

        const { title, description, isHwOrQr } = getTitleAndDescription({
          wallet,
          isRemoveToMocked,
          intl,
        });
        showWalletRemoveDialog({
          config,
          title,
          description,
          // No checkbox for hw/qr wallets.
          showCheckBox: !isHwOrQr,
          defaultChecked: false,
          wallet,
          isRemoveToMocked,
        });
      }}
    />
  );
}
