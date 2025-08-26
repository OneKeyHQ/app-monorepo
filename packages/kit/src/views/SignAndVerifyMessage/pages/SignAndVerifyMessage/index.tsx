import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Divider,
  Form,
  Input,
  Page,
  Radio,
  SegmentControl,
  Select,
  SizableText,
  Switch,
  TextAreaInput,
  XStack,
  YStack,
  useForm,
} from '@onekeyhq/components';
import type { UseFormReturn } from '@onekeyhq/components';
import { NetworkAvatar } from '@onekeyhq/kit/src/components/NetworkAvatar';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ESignAndVerifyAction } from '@onekeyhq/shared/types/signAndVerify';

type ISignFormData = {
  message: string;
  address: string;
  format: string;
  signature: string;
  hexFormat: boolean;
};

const SignForm = ({ form }: { form: UseFormReturn<ISignFormData> }) => {
  const intl = useIntl();

  return (
    <Form form={form}>
      <Form.Field
        name="message"
        label={intl.formatMessage({
          id: ETranslations.global_hex_data,
        })}
        labelAddon={
          <XStack alignItems="center" gap="$2">
            <SizableText color="$text" size="$bodyMd">
              {intl.formatMessage({
                id: ETranslations.message_signing_address_hex_format,
              })}
            </SizableText>
            <Form.Field name="hexFormat">
              <Switch size="small" />
            </Form.Field>
          </XStack>
        }
      >
        <TextAreaInput
          size="large"
          placeholder={intl.formatMessage({
            id: ETranslations.message_signing_address_placeholder,
          })}
        />
      </Form.Field>

      <Form.Field
        label={intl.formatMessage({
          id: ETranslations.global_address,
        })}
        name="address"
        description={intl.formatMessage({
          id: ETranslations.message_signing_address_desc,
        })}
      >
        <Select
          title={intl.formatMessage({
            id: ETranslations.global_address,
          })}
          placeholder={intl.formatMessage({
            id: ETranslations.global_address,
          })}
          items={[
            {
              label: 'bc1p2y20...3fzymr',
              value: 'bc1p2y20...3fzymr',
            },
          ]}
          defaultTriggerInputProps={{
            leftAddOnProps: {
              size: 'large',
              renderContent: (
                <XStack alignItems="center" px="$1" mr="$-3">
                  <NetworkAvatar networkId={getNetworkIdsMap().btc} size="$6" />
                </XStack>
              ),
            },
          }}
        />
      </Form.Field>

      <Divider />

      <Form.Field label="Format" name="format">
        <Radio
          orientation="horizontal"
          gap="$5"
          options={[
            { label: 'Electrum', value: 'electrum' },
            { label: 'BIP137', value: 'bip137' },
            { label: 'BIP322', value: 'bip322' },
          ]}
        />
      </Form.Field>

      <Form.Field
        label={intl.formatMessage({
          id: ETranslations.message_signing_signature_label,
        })}
        name="signature"
      >
        <Input
          placeholder={intl.formatMessage({
            id: ETranslations.message_signing_signature_desc,
          })}
          editable={false}
          addOns={[
            {
              iconName: 'Copy3Outline',
              onPress: () => {
                console.log('copy');
              },
              disabled: true,
            },
          ]}
        />
      </Form.Field>
    </Form>
  );
};

function SignAndVerifyMessage() {
  const intl = useIntl();
  const [action, setAction] = useState(ESignAndVerifyAction.Sign);

  const signForm = useForm<ISignFormData>({
    defaultValues: {
      message: '',
      address: '',
      format: 'electrum',
      signature: '',
      hexFormat: false,
    },
  });

  const signFormValues = signForm.watch();
  const isSignDisabled = useMemo(
    () => !signFormValues.message || !signFormValues.address,
    [signFormValues],
  );

  const handleSign = useCallback(() => {
    console.log('Sign form values:', signForm.getValues());
  }, [signForm]);

  const renderContent = useCallback(() => {
    if (action === ESignAndVerifyAction.Sign) {
      return <SignForm form={signForm} />;
    }
    return <SizableText>Verify message</SizableText>;
  }, [action, signForm]);

  return (
    <Page scrollEnabled onClose={() => {}} safeAreaEnabled>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.message_signing_main_title,
        })}
      />
      <Page.Body>
        <YStack p="$5" gap="$5">
          <SegmentControl
            value={action}
            fullWidth
            onChange={(v) => {
              setAction(v as ESignAndVerifyAction);
            }}
            options={[
              {
                label: intl.formatMessage({
                  id: ETranslations.message_signing_sign_action,
                }),
                value: ESignAndVerifyAction.Sign,
              },
              {
                label: intl.formatMessage({
                  id: ETranslations.message_signing_verify_action,
                }),
                value: ESignAndVerifyAction.Verify,
              },
            ]}
          />
          {renderContent()}
        </YStack>
      </Page.Body>
      <Page.Footer
        onConfirmText={intl.formatMessage({
          id: ETranslations.global_sign,
        })}
        confirmButtonProps={{
          disabled: action !== ESignAndVerifyAction.Sign || isSignDisabled,
          loading: false,
        }}
        onConfirm={
          action === ESignAndVerifyAction.Sign ? handleSign : undefined
        }
      />
    </Page>
  );
}

export default SignAndVerifyMessage;
