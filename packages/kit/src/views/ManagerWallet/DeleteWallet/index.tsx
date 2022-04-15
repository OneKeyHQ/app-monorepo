import React, { FC } from 'react';

import { useIntl } from 'react-intl';

import { OnCloseCallback } from '@onekeyhq/components/src/Dialog/components/FooterButton';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import GlobalDialog, { useDialog } from '@onekeyhq/kit/src/components/Dialog';
import { useActiveWalletAccount } from '@onekeyhq/kit/src/hooks/redux';
import { useToast } from '@onekeyhq/kit/src/hooks/useToast';
import {
  GlobalDialogIds,
  GlobalDialogParams,
} from '@onekeyhq/kit/src/routes/Dialog';
import { setRefreshTS } from '@onekeyhq/kit/src/store/reducers/settings';

export type DeleteWalletProp = {
  walletId: string;
  password: string;
};

const ManagerWalletDeleteDialog: FC = () => {
  const intl = useIntl();
  const toast = useToast();
  const { wallet: activeWallet } = useActiveWalletAccount();
  const { dispatch, engine, serviceAccount } = backgroundApiProxy;

  const dialogId = GlobalDialogIds.DeleteWalletDialog;
  const { args, hide, resolve } =
    useDialog<GlobalDialogParams[GlobalDialogIds.DeleteWalletDialog]>(dialogId);

  const { walletId, password } = args ?? {};
  const [isLoading, setIsLoading] = React.useState(false);

  return (
    <GlobalDialog
      dialogId={dialogId}
      canceledOnTouchOutside={false}
      onClose={() => hide?.()}
      contentProps={{
        iconType: 'danger',
        title: intl.formatMessage({
          id: 'action__delete_wallet',
        }),
        content: intl.formatMessage({
          id: 'dialog__delete_wallet_desc',
        }),
      }}
      footerButtonProps={{
        primaryActionProps: {
          type: 'destructive',
          children: intl.formatMessage({ id: 'action__delete' }),
          isLoading,
        },
        onPrimaryActionPress: ({ onClose }: OnCloseCallback) => {
          if (!walletId) return;

          setIsLoading(true);

          engine
            .getWallet(walletId)
            .then(async (wallet) => {
              await engine.removeWallet(walletId, password ?? '');
              if (activeWallet?.id === walletId) {
                await serviceAccount.autoChangeWallet();
              }
              dispatch(setRefreshTS());
              toast.info(
                intl.formatMessage(
                  { id: 'msg__wallet_deleted' },
                  { 0: wallet.name },
                ),
              );
              resolve?.(true);
              onClose?.();
            })
            .catch((e) => {
              toast.info(intl.formatMessage({ id: 'msg__unknown_error' }));
              console.log(e);
            })
            .finally(() => {
              setIsLoading(false);
            });
        },
      }}
    />
  );
};

export default ManagerWalletDeleteDialog;
