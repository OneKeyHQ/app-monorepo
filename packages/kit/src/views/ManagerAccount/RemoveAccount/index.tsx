import React, { useCallback, useMemo, useRef } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, useToast } from '@onekeyhq/components';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useActiveWalletAccount } from '../../../hooks/redux';

export default function useRemoveAccountDialog() {
  const intl = useIntl();
  const toast = useToast();
  const { engine, serviceAccount } = backgroundApiProxy;
  const { account: activeAccount } = useActiveWalletAccount();
  const successCall = useRef<() => void>();

  const [visible, setVisible] = React.useState(false);
  const [accountId, setAccountId] = React.useState('');
  const [walletId, setWalletId] = React.useState('');
  const [password, setPassword] = React.useState<string | undefined>();

  const onSubmit = useCallback(() => {
    if (!accountId) return;
    engine
      .removeAccount(accountId, password ?? '')
      .then(async () => {
        toast.show({ title: intl.formatMessage({ id: 'msg__removed' }) });
        setVisible(false);

        if (activeAccount?.id === accountId) {
          await serviceAccount.autoChangeAccount({ walletId });
        }
        successCall?.current?.();
      })
      .catch(() => {
        toast.show({ title: intl.formatMessage({ id: 'msg__unknown_error' }) });
      });
  }, [
    accountId,
    activeAccount?.id,
    engine,
    intl,
    password,
    serviceAccount,
    toast,
    walletId,
  ]);

  const show = (
    $walletId: string,
    $accountId: string,
    $password: string | undefined,
    call?: (() => void) | undefined,
  ) => {
    successCall.current = call;
    setAccountId($accountId);
    setPassword($password);
    setWalletId($walletId);
    setTimeout(() => setVisible(true), 250);
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
