import React, { useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, Form, useForm } from '@onekeyhq/components';
import DialogCommon from '@onekeyhq/components/src/Dialog/components';
import { Account } from '@onekeyhq/engine/src/types/account';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useToast } from '../../../hooks/useToast';

type FieldValues = { name: string };

export default function useAccountModifyNameDialog() {
  const intl = useIntl();
  const toast = useToast();
  const { engine } = backgroundApiProxy;

  const successCall = useRef<() => void>();

  const [visible, setVisible] = React.useState(false);
  const [accountId, setAccountId] = React.useState('');
  const [networkId, setNetworkId] = React.useState('');

  const [account, setAccount] = useState<Account>();
  const [isLoading, setIsLoading] = React.useState(false);

  const { control, handleSubmit, setError, reset } = useForm<FieldValues>({
    defaultValues: { name: '' },
  });

  const show = (
    $accountId: string,
    $networkId: string,
    call?: (() => void) | undefined,
  ) => {
    reset();
    successCall.current = call;
    setAccountId($accountId);
    setNetworkId($networkId);
    setVisible(true);
  };

  useEffect(() => {
    if (!accountId || !networkId) return;
    engine.getAccount(accountId, networkId).then(($account) => {
      setAccount($account);
    });
  }, [accountId, engine, networkId]);

  const onSubmit = handleSubmit(async (values: FieldValues) => {
    if (!account) return;

    setIsLoading(true);
    // 判断名字重复
    // const existsName = wallets.find((w) => w.name === values.name);
    // if (existsName) {
    //   setError('name', {
    //     message: intl.formatMessage({
    //       id: 'form__account_name_invalid_exists',
    //     }),
    //   });
    //   setIsLoading(false);
    //   return;
    // }

    const changedAccount = await engine.setAccountName(accountId, values.name);
    if (changedAccount) {
      toast.info(intl.formatMessage({ id: 'msg__renamed' }));
      setVisible(false);
      successCall?.current?.();
    } else {
      setError('name', {
        message: intl.formatMessage({ id: 'msg__unknown_error' }),
      });
    }
    setIsLoading(false);
  });

  const AccountModifyNameDialog = useMemo(
    () =>
      visible && (
        <Dialog visible={visible}>
          <Form>
            <Form.Item
              name="name"
              defaultValue=""
              control={control}
              rules={{
                required: intl.formatMessage({ id: 'form__field_is_required' }),
                maxLength: {
                  value: 24,
                  message: intl.formatMessage(
                    {
                      id: 'form__account_name_invalid_characters_limit',
                    },
                    { 0: '24' },
                  ),
                },
              }}
            >
              <Form.Input placeholder={account?.name ?? ''} />
            </Form.Item>
            <DialogCommon.FooterButton
              marginTop={0}
              secondaryActionTranslationId="action__cancel"
              onSecondaryActionPress={() => setVisible(false)}
              onPrimaryActionPress={() => onSubmit()}
              primaryActionTranslationId="action__rename"
              primaryActionProps={{
                isLoading,
              }}
            />
          </Form>
        </Dialog>
      ),
    [visible, control, intl, account?.name, isLoading, onSubmit],
  );

  return { show, AccountModifyNameDialog };
}
