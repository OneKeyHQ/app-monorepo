import React, { useCallback, useMemo, useRef } from 'react';

import { useIntl } from 'react-intl';

import { Dialog } from '@onekeyhq/components';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useActiveWalletAccount } from '../../../hooks/redux';
import { useToast } from '../../../hooks/useToast';

export default function useRemoveAccountDialog() {
  const intl = useIntl();
  const toast = useToast();
  const { engine, serviceApp } = backgroundApiProxy;
  const { account: activeAccount } = useActiveWalletAccount();
  const successCall = useRef<() => void>();

  const [visible, setVisible] = React.useState(false);
  const [accountId, setAccountId] = React.useState('');
  const [walletId, setWalletId] = React.useState('');
  const [password, setPassword] = React.useState('');

  const onSubmit = useCallback(() => {
    if (!accountId || !password) return;
    engine
      .removeAccount(accountId, password)
      .then(async () => {
        toast.info(intl.formatMessage({ id: 'msg__removed' }));
        setVisible(false);

        if (activeAccount?.id === accountId) {
          await serviceApp.autoChangeAccount({ walletId });
        }
        successCall?.current?.();
      })
      .catch((e) => {
        console.error(e);

        toast.info(intl.formatMessage({ id: 'msg__unknown_error' }));
      });
  }, [
    accountId,
    activeAccount?.id,
    engine,
    intl,
    password,
    serviceApp,
    toast,
    walletId,
  ]);

  const show = (
    $walletId: string,
    $accountId: string,
    $password: string,
    call?: (() => void) | undefined,
  ) => {
    successCall.current = call;
    setAccountId($accountId);
    setPassword($password);
    setWalletId($walletId);
    setTimeout(() => setVisible(true), 200);
  };

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
            },
            primaryActionTranslationId: 'action__remove',
            onPrimaryActionPress: () => {
              onSubmit();
            },
            onSecondaryActionPress: () => setVisible(false),
          }}
        />
      ),

    [intl, onSubmit, visible],
  );

  return { RemoveAccountDialog, show };
}
