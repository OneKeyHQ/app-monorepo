import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { ActionList } from '@onekeyhq/components';
import { useAccountSelectorContextData } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

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
      icon={icon}
      destructive
      label={label}
      onClose={onClose}
      onPress={() => {
        const { title, description, isHwOrQr, isKeyless } =
          getTitleAndDescription({
            wallet,
            isRemoveToMocked,
          });
        showWalletRemoveDialog({
          config,
          title,
          description,
          // No checkbox for hw/qr wallets (keyless has its own checkbox logic)
          showCheckBox: !isHwOrQr && !isKeyless,
          defaultChecked: false,
          wallet,
          isRemoveToMocked,
          isKeyless,
        });
      }}
    />
  );
}
