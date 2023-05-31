import type { FC } from 'react';
import { useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Center,
  Dialog,
  Form,
  Typography,
  useForm,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import DialogCommon from '@onekeyhq/components/src/Dialog/components';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { updateCustomNetworkRpc } from '../../../store/reducers/settings';
import { RpcNodePattern } from '../constants';
import { measureRpc, useRPCUrls } from '../hooks';

type Props = {
  onClose?: () => void;
  onConfirm?: () => void;
  networkId: string;
};

type FieldValues = { url: string };

const TrimInput = ({
  value,
  onChange,
}: {
  value?: string;
  onChange?: (text: string) => void;
}) => {
  const isSmallScreen = useIsVerticalLayout();
  return (
    <Form.Input
      value={value}
      // @ts-ignore
      onChange={(v: string) => onChange?.(v?.trim?.())}
      size={isSmallScreen ? 'xl' : 'default'}
      autoFocus
      focusable
      placeholder="https://"
    />
  );
};

const AddNodeDialog: FC<Props> = ({ onClose, onConfirm, networkId }) => {
  const intl = useIntl();

  const { custom, preset } = useRPCUrls(networkId);
  const [isLoading, setIsLoading] = useState(false);

  const { control, handleSubmit, setError } = useForm<FieldValues>({
    defaultValues: { url: '' },
  });

  const onSubmit = handleSubmit(async (values: FieldValues) => {
    setIsLoading(true);
    const { url } = values;
    let hasError = false;
    try {
      const [measureRes, chainIdRes] = await Promise.all([
        measureRpc(networkId, url, false),
        backgroundApiProxy.serviceNetwork.fetchRpcChainId({
          url,
          networkId,
        }),
      ]);
      if (
        !measureRes.latestBlock ||
        !(chainIdRes === null || networkId.endsWith(chainIdRes))
      ) {
        hasError = true;
      }
    } catch (error) {
      hasError = true;
    }
    if (hasError) {
      setError(
        'url',
        {
          message: intl.formatMessage({ id: 'form__rpc_fetched_failed' }),
        },
        {
          shouldFocus: true,
        },
      );
      setIsLoading(false);
      return;
    }
    backgroundApiProxy.dispatch(
      updateCustomNetworkRpc({
        networkId,
        type: 'add',
        rpc: url,
      }),
    );
    onClose?.();
    onConfirm?.();
  });

  return (
    <Dialog visible>
      <Center w="full" mb="6">
        <Typography.DisplayMedium>
          {intl.formatMessage({ id: 'action__add_node' })}
        </Typography.DisplayMedium>
      </Center>
      <Form>
        <Form.Item
          name="url"
          defaultValue=""
          control={control}
          rules={{
            required: {
              value: true,
              message: intl.formatMessage({
                id: 'form__field_is_required',
              }),
            },
            pattern: {
              value: RpcNodePattern,
              message: intl.formatMessage({
                id: 'form__rpc_url_wrong_format',
              }),
            },
            validate: (value) => {
              if (custom.includes(value) || preset.includes(value)) {
                return intl.formatMessage({
                  id: 'content__existing',
                });
              }
            },
          }}
        >
          <TrimInput />
        </Form.Item>
        <DialogCommon.FooterButton
          marginTop={0}
          secondaryActionTranslationId="action__cancel"
          onSecondaryActionPress={() => onClose?.()}
          onPrimaryActionPress={() => onSubmit()}
          primaryActionTranslationId="action__confirm"
          primaryActionProps={{
            isLoading,
          }}
        />
      </Form>
    </Dialog>
  );
};

export default AddNodeDialog;
