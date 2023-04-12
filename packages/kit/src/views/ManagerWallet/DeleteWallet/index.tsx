import type { FC } from 'react';
import { useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { CheckBox, Dialog, ToastManager } from '@onekeyhq/components';
import type { OnCloseCallback } from '@onekeyhq/components/src/Dialog/components/FooterButton';
import timelinePerfTrace, {
  ETimelinePerfNames,
} from '@onekeyhq/shared/src/perf/timelinePerfTrace';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useNavigationActions } from '../../../hooks';
import { wait } from '../../../utils/helper';

export type DeleteWalletProp = {
  walletId: string;
  password: string | undefined;
  hardware?: {
    isPassphrase: boolean;
  };
};

type ManagerWalletDeleteDialogProps = {
  deleteWallet: DeleteWalletProp | undefined;
  onClose?: () => void;
};

const ManagerWalletDeleteDialog: FC<ManagerWalletDeleteDialogProps> = ({
  deleteWallet,
  onClose: closeOverlay,
}) => {
  const intl = useIntl();

  const { engine, serviceAccount } = backgroundApiProxy;
  const { closeWalletSelector } = useNavigationActions();

  const { walletId, password, hardware } = deleteWallet ?? {};
  const [isLoading, setIsLoading] = useState(false);
  // If a hardware wallet is being deleted, no second confirmation is required.
  const [confirmed, setConfirmed] = useState(!!hardware ?? false);

  const titleContent = useMemo(() => {
    if (hardware) {
      if (hardware.isPassphrase) {
        return intl.formatMessage({
          id: 'dialog__delete_hardware_passphrase_wallet_desc',
        });
      }
      return intl.formatMessage({ id: 'dialog__delete_hardware_wallet_desc' });
    }
    return intl.formatMessage({ id: 'dialog__delete_wallet_desc' });
  }, [hardware, intl]);

  return (
    <Dialog
      visible
      canceledOnTouchOutside={false}
      onClose={() => {
        setConfirmed(false); // Forget confirmed status
        closeOverlay?.();
      }}
      contentProps={{
        iconType: 'danger',
        title: intl.formatMessage({
          id:
            hardware && !hardware?.isPassphrase
              ? 'action__delete_device'
              : 'action__delete_wallet',
        }),
        content: titleContent,
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
        secondaryActionProps: {
          size: 'xl',
        },
        primaryActionProps: {
          size: 'xl',
          type: 'destructive',
          children: intl.formatMessage({ id: 'action__remove' }),
          isLoading,
          disabled: !hardware && !confirmed,
          isDisabled: !hardware && !confirmed,
        },
        onPrimaryActionPress: async ({ onClose }: OnCloseCallback) => {
          if (!walletId) return;

          setIsLoading(true);

          await wait(100);

          timelinePerfTrace.clear(ETimelinePerfNames.removeWallet);
          timelinePerfTrace.mark({
            name: ETimelinePerfNames.removeWallet,
            title:
              'ManagerWalletDeleteDialog >> remove wallet start =======================',
          });

          engine
            .getWallet(walletId)
            .then(async (wallet) => {
              timelinePerfTrace.mark({
                name: ETimelinePerfNames.removeWallet,
                title: 'ManagerWalletDeleteDialog >> engine.getWallet DONE',
              });

              if (
                hardware &&
                !hardware?.isPassphrase &&
                wallet.associatedDevice
              ) {
                await serviceAccount.removeWalletAndDevice(
                  walletId,
                  wallet.associatedDevice,
                );
              } else {
                await serviceAccount.removeWallet(walletId, password);
              }

              timelinePerfTrace.mark({
                name: ETimelinePerfNames.removeWallet,
                title:
                  'ManagerWalletDeleteDialog >> serviceAccount.removeWallet DONE',
              });

              ToastManager.show({
                title: intl.formatMessage(
                  { id: 'msg__wallet_deleted' },
                  { 0: wallet.name },
                ),
              });
              onClose?.();
              setTimeout(() => {
                closeWalletSelector();
              }, 100);
            })
            .catch((e) => {
              ToastManager.show({
                title: intl.formatMessage({ id: 'msg__unknown_error' }),
              });
              console.log(e);
            })
            .finally(() => {
              setIsLoading(false);
              setConfirmed(false);

              timelinePerfTrace.mark({
                name: ETimelinePerfNames.removeWallet,
                title: 'ManagerWalletDeleteDialog >> remove wallet end',
              });
            });
        },
      }}
    />
  );
};

export default ManagerWalletDeleteDialog;
