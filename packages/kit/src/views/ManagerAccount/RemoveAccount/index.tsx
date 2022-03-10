import React, { useCallback, useMemo, useRef } from 'react';

import { useIntl } from 'react-intl';

import { Dialog } from '@onekeyhq/components';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useToast } from '../../../hooks/useToast';

export default function useRemoveAccountDialog() {
  const intl = useIntl();
  const toast = useToast();
  const { engine } = backgroundApiProxy;

  const successCall = useRef<() => void>();

  const [visible, setVisible] = React.useState(false);
  const [accountId, setAccountId] = React.useState('');
  const [password, setPassword] = React.useState('');

  const onSubmit = useCallback(() => {
    if (!accountId || !password) return;
    engine
      .removeAccount(accountId, password)
      .then(() => {
        toast.info(intl.formatMessage({ id: 'msg__removed' }));
        setVisible(false);
        successCall?.current?.();
      })
      .catch(() => {
        toast.info(intl.formatMessage({ id: 'msg__unknown_error' }));
      });
  }, [accountId, engine, intl, password, toast]);

  const show = (
    $accountId: string,
    $password: string,
    call?: (() => void) | undefined,
  ) => {
    successCall.current = call;
    setAccountId($accountId);
    setPassword($password);
    setVisible(true);
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
