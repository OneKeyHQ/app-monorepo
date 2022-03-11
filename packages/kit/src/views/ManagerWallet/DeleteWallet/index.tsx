import React, { FC } from 'react';

import { useIntl } from 'react-intl';

import { Dialog } from '@onekeyhq/components';
import { OnCloseCallback } from '@onekeyhq/components/src/Dialog/components/FooterButton';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useToast } from '../../../hooks/useToast';
import { removeWalletById } from '../../../store/reducers/wallet';

type ManagerWalletDeleteDialogProps = {
  walletId: string;
  password: string;
  onDialogClose: () => void;
};

const ManagerWalletDeleteDialog: FC<ManagerWalletDeleteDialogProps> = ({
  walletId,
  password,
  onDialogClose,
}) => {
  const intl = useIntl();
  const toast = useToast();
  const { dispatch, engine } = backgroundApiProxy;

  const [isLoading, setIsLoading] = React.useState(false);

  return (
    <Dialog
      visible
      canceledOnTouchOutside={false}
      onClose={() => onDialogClose?.()}
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
          setIsLoading(true);

          engine
            .getWallet(walletId)
            .then(async (wallet) => {
              await engine.removeWallet(walletId, password);
              dispatch(removeWalletById(walletId));

              toast.info(
                intl.formatMessage(
                  { id: 'msg__wallet_deleted' },
                  { 0: wallet.name },
                ),
              );
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
