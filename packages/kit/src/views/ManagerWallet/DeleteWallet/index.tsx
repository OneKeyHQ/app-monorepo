import type { FC } from 'react';
import { useState } from 'react';

import { useIntl } from 'react-intl';

import { CheckBox, Dialog, useToast } from '@onekeyhq/components';
import type { OnCloseCallback } from '@onekeyhq/components/src/Dialog/components/FooterButton';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useNavigationActions } from '../../../hooks';

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
  const { closeWalletSelector } = useNavigationActions();

  const { walletId, password, hardware } = deleteWallet ?? {};
  const [isLoading, setIsLoading] = useState(false);
  // If a hardware wallet is being deleted, no second confirmation is required.
  const [confirmed, setConfirmed] = useState(hardware ?? false);

  return (
    <Dialog
      hasFormInsideDialog
      visible={visible}
      canceledOnTouchOutside={false}
      onClose={() => {
        setConfirmed(false); // Forget confirmed status
        onDialogClose?.();
      }}
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
        input: hardware ? undefined : (
          <CheckBox
            w="full"
            mt="4"
            isChecked={confirmed}
            defaultIsChecked={false}
            onChange={(checked) => {
              setConfirmed(checked);
            }}
            title={intl.formatMessage({
              id: 'checkbox__i_have_written_down_phrase',
            })}
            description={intl.formatMessage({
              id: 'checkbox__i_have_written_down_phrase_desc',
            })}
          />
        ),
      }}
      footerButtonProps={{
        primaryActionProps: {
          type: 'destructive',
          children: intl.formatMessage({ id: 'action__remove' }),
          isLoading,
          disabled: !hardware && !confirmed,
          isDisabled: !hardware && !confirmed,
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
              setTimeout(() => {
                closeWalletSelector();
              }, 600);
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
