import { useCallback, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, ToastManager } from '@onekeyhq/components';
import type { IWallet } from '@onekeyhq/engine/src/types';
import {
  WALLET_TYPE_EXTERNAL,
  WALLET_TYPE_HW,
  WALLET_TYPE_WATCHING,
} from '@onekeyhq/engine/src/types/wallet';
import {
  AppUIEventBusNames,
  appUIEventBus,
} from '@onekeyhq/shared/src/eventBus/appUIEventBus';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { ValidationFields } from '../../../components/Protected';
import useLocalAuthenticationModal from '../../../hooks/useLocalAuthenticationModal';

export default function useRemoveAccountDialog() {
  const intl = useIntl();

  const { serviceAccount } = backgroundApiProxy;
  const successCall = useRef<() => void>();

  const [visible, setVisible] = useState(false);
  const [accountId, setAccountId] = useState('');
  const [walletId, setWalletId] = useState('');
  const [networkId, setNetworkId] = useState('');
  const [password, setPassword] = useState<string | undefined>();
  const { showVerify } = useLocalAuthenticationModal();
  const onSubmit = useCallback(async () => {
    if (!accountId) return Promise.resolve();
    const removed = await serviceAccount.getAccount({ walletId, accountId });
    return serviceAccount
      .removeAccount(walletId, accountId, password ?? '', networkId)
      .then(() => {
        ToastManager.show({
          title: intl.formatMessage({ id: 'msg__removed' }),
        });
        appUIEventBus.emit(AppUIEventBusNames.RemoveAccount, removed);
        setVisible(false);
        successCall?.current?.();
      })
      .catch((e) => {
        ToastManager.show({
          title: intl.formatMessage({ id: 'msg__unknown_error' }),
        });
        console.log(e);
      });
  }, [accountId, intl, password, serviceAccount, walletId, networkId]);

  const show = (
    $walletId: string,
    $accountId: string,
    $password: string | undefined,
    $networkId: string,
    call?: (() => void) | undefined,
  ) => {
    successCall.current = call;
    setAccountId($accountId);
    setPassword($password);
    setWalletId($walletId);
    setNetworkId($networkId);
    setTimeout(() => setVisible(true), 250);
  };

  const goToRemoveAccount = useCallback(
    (options: {
      wallet: IWallet | null | undefined;
      accountId: string;
      networkId: string;
      callback?: (() => void) | undefined;
    }) => {
      const { wallet, callback } = options;
      const shouldVerifyPwd =
        wallet?.type !== WALLET_TYPE_HW &&
        wallet?.type !== WALLET_TYPE_WATCHING &&
        wallet?.type !== WALLET_TYPE_EXTERNAL;
      const $$walletId = wallet?.id ?? '';
      if (shouldVerifyPwd) {
        showVerify(
          (pwd) => {
            show(
              $$walletId,
              options.accountId,
              pwd,
              options.networkId,
              callback,
            );
          },
          () => {},
          null,
          ValidationFields.Account,
        );
      } else {
        show(
          $$walletId,
          options.accountId,
          undefined,
          options.networkId,
          callback,
        );
      }
    },
    [showVerify],
  );

  const RemoveAccountDialog = useMemo(
    () =>
      visible && (
        <Dialog
          visible={visible}
          contentProps={{
            iconType: 'danger',
            title: intl.formatMessage({ id: 'action__remove_account' }),
            content: intl.formatMessage({
              id: 'dialog__remove_account_desc',
            }),
          }}
          footerButtonProps={{
            primaryActionProps: {
              type: 'destructive',
              onPromise: () => onSubmit(),
            },
            primaryActionTranslationId: 'action__remove',

            onSecondaryActionPress: () => setVisible(false),
          }}
        />
      ),

    [intl, onSubmit, visible],
  );

  return { RemoveAccountDialog, show, goToRemoveAccount };
}
