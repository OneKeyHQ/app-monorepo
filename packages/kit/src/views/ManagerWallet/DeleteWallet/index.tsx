import React, { FC } from 'react';

import { useIntl } from 'react-intl';

import backgroundApiProxy from '@onekeyhq//kit/src/background/instance/backgroundApiProxy';
import { Dialog, useToast } from '@onekeyhq/components';
import { OnCloseCallback } from '@onekeyhq/components/src/Dialog/components/FooterButton';

export type DeleteWalletProp = {
  walletId: string;
  password: string | undefined;
  hardware?: boolean;
};

type ManagerWalletDeleteDialogProps = {
  visible: boolean;
  deleteWallet: DeleteWalletProp | undefined;
  onDialogClose: () => void;
};

const ManagerWalletDeleteDialog: FC<ManagerWalletDeleteDialogProps> = ({
  visible,
  deleteWallet,
  onDialogClose,
}) => {
  const intl = useIntl();
  const toast = useToast();
  const { engine, serviceAccount } = backgroundApiProxy;

  const { walletId, password, hardware } = deleteWallet ?? {};
  const [isLoading, setIsLoading] = React.useState(false);

  return (
    <Dialog
      visible={visible}
      canceledOnTouchOutside={false}
      onClose={() => onDialogClose?.()}
      contentProps={{
        iconType: 'danger',
        title: intl.formatMessage({
          id: 'action__delete_wallet',
        }),
        content: intl.formatMessage({
          id: hardware
            ? 'dialog__delete_hardware_wallet_desc'
            : 'dialog__delete_wallet_desc',
        }),
      }}
      footerButtonProps={{
        primaryActionProps: {
          type: 'destructive',
          children: intl.formatMessage({ id: 'action__remove' }),
          isLoading,
        },
        onPrimaryActionPress: ({ onClose }: OnCloseCallback) => {
          if (!walletId) return;

          setIsLoading(true);

          engine
            .getWallet(walletId)
            .then(async (wallet) => {
              await serviceAccount.removeWallet(walletId, password);
              toast.show({
                title: intl.formatMessage(
                  { id: 'msg__wallet_deleted' },
                  { 0: wallet.name },
                ),
              });
              onClose?.();
            })
            .catch((e) => {
              toast.show({
                title: intl.formatMessage({ id: 'msg__unknown_error' }),
              });
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
