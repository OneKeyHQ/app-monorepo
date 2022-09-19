import React, { useCallback, useMemo, useRef } from 'react';

import { useIntl } from 'react-intl';

import backgroundApiProxy from '@onekeyhq//kit/src/background/instance/backgroundApiProxy';
import { Dialog, useToast } from '@onekeyhq/components';

export default function useRemoveAccountDialog() {
  const intl = useIntl();
  const toast = useToast();
  const { serviceAccount } = backgroundApiProxy;
  const successCall = useRef<() => void>();

  const [visible, setVisible] = React.useState(false);
  const [accountId, setAccountId] = React.useState('');
  const [walletId, setWalletId] = React.useState('');
  const [password, setPassword] = React.useState<string | undefined>();

  const onSubmit = useCallback(() => {
    if (!accountId) return Promise.resolve();
    return serviceAccount
      .removeAccount(walletId, accountId, password ?? '')
      .then(() => {
        toast.show({ title: intl.formatMessage({ id: 'msg__removed' }) });
        setVisible(false);
        successCall?.current?.();
      })
      .catch((e) => {
        toast.show({ title: intl.formatMessage({ id: 'msg__unknown_error' }) });
        console.log(e);
      });
  }, [accountId, intl, password, serviceAccount, toast, walletId]);

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
              onPromise: () => onSubmit(),
            },
            primaryActionTranslationId: 'action__remove',

            onSecondaryActionPress: () => setVisible(false),
          }}
        />
      ),

    [intl, onSubmit, visible],
  );

  return { RemoveAccountDialog, show };
}
