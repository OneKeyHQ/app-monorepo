import { useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { isNil } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Button,
  Form,
  Input,
  TextAreaInput,
  useForm,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useUnsignedTxsAtom } from '@onekeyhq/kit/src/states/jotai/contexts/sendConfirm';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

type IProps = {
  accountId: string;
  networkId: string;
};

function TxAdvancedSettingsContainer(props: IProps) {
  const { accountId, networkId } = props;
  const intl = useIntl();
  const [unsignedTxs] = useUnsignedTxsAtom();
  const [settings] = useSettingsPersistAtom();

  const vaultSettings = usePromiseResult(
    async () =>
      backgroundApiProxy.serviceNetwork.getVaultSettings({ networkId }),
    [networkId],
  ).result;

  const canEditNonce = useMemo(
    () =>
      unsignedTxs.length === 1 &&
      vaultSettings?.canEditNonce &&
      settings.isCustomNonceEnabled &&
      !isNil(unsignedTxs[0].nonce),
    [settings.isCustomNonceEnabled, unsignedTxs, vaultSettings?.canEditNonce],
  );

  const currentNonce = unsignedTxs[0].nonce;

  const form = useForm({
    defaultValues: {
      nonce: canEditNonce
        ? new BigNumber(unsignedTxs[0].nonce ?? 0).toFixed()
        : undefined,
    },
    mode: 'onChange',
    reValidateMode: 'onBlur',
  });

  const handleValidateNonce = useCallback(() => {}, []);
  const handleValidateData = useCallback(() => {}, []);

  return (
    <Form form={form}>
      <Form.Field
        label={intl.formatMessage({
          id: ETranslations.global_nonce,
        })}
        name="nonce"
        rules={{
          min: 0,
          required: true,
          validate: handleValidateNonce,
          onChange: (e: { target: { name: string; value: string } }) => {
            const value = e.target?.value;
            const valueBN = new BigNumber(value ?? 0);
            if (!valueBN.isInteger() || valueBN.isNegative()) {
              return;
            }
            form.setValue('nonce', valueBN.toFixed());
          },
        }}
        description={intl.formatMessage(
          {
            id: ETranslations.global_nonce_desc,
          },
          {
            'amount': currentNonce,
          },
        )}
        labelAddon={
          <Button size="small" variant="tertiary" icon="WalletOutline">
            {intl.formatMessage({
              id: ETranslations.global_nonce_faq,
            })}
          </Button>
        }
      >
        <Input flex={1} />
      </Form.Field>
      <Form.Field
        label={intl.formatMessage({
          id: ETranslations.global_hex_data,
        })}
        name="data"
        rules={{
          validate: handleValidateData,
        }}
        labelAddon={
          <Button size="small" variant="tertiary" icon="WalletOutline">
            {intl.formatMessage({
              id: ETranslations.global_hex_data_faq,
            })}
          </Button>
        }
      >
        <TextAreaInput flex={1} />
      </Form.Field>
    </Form>
  );
}

export { TxAdvancedSettingsContainer };
