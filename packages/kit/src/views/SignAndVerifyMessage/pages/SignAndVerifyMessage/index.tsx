import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/core';
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
import type { ISelectSection, UseFormReturn } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { NetworkAvatar } from '@onekeyhq/kit/src/components/NetworkAvatar';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalSignAndVerifyRoutes,
  IModalSignAndVerifyParamList,
} from '@onekeyhq/shared/src/routes/signAndVerify';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { ISignAccount } from '@onekeyhq/shared/types/signAndVerify';
import { ESignAndVerifyAction } from '@onekeyhq/shared/types/signAndVerify';

import type { RouteProp } from '@react-navigation/core';

type ISignFormData = {
  message: string;
  address: string;
  format: string;
  signature: string;
  hexFormat: boolean;
};

const SignForm = ({
  form,
  networkId,
  accountId,
  indexedAccountId,
  isOthersWallet,
}: {
  form: UseFormReturn<ISignFormData>;
  networkId: string;
  accountId: string | undefined;
  indexedAccountId: string | undefined;
  isOthersWallet: boolean | undefined;
}) => {
  const intl = useIntl();
  const signAccountsRef = useRef<ISignAccount[]>([]);
  // const currentSignAccount = useState<ISignAccount | undefined>(undefined);
  const { result: selectOptions } = usePromiseResult<ISelectSection[]>(
    async () => {
      const signAccounts =
        await backgroundApiProxy.serviceInternalSignAndVerify.getSignAccounts({
          networkId,
          accountId,
          indexedAccountId,
          isOthersWallet,
        });
      signAccountsRef.current = signAccounts;
      const result: ISelectSection[] = [];
      const ethereumAccount = signAccounts.find(
        (account) => account.network.id === getNetworkIdsMap().eth,
      );
      if (ethereumAccount) {
        result.push({
          title: ethereumAccount.network.name,
          data: [
            {
              label: accountUtils.shortenAddress({
                address: ethereumAccount.account.address,
              }),
              value: ethereumAccount.account.address,
            },
          ],
        });
      }

      const solanaAccount = signAccounts.find(
        (account) => account.network.id === getNetworkIdsMap().sol,
      );
      if (solanaAccount) {
        result.push({
          title: solanaAccount.network.name,
          data: [
            {
              label: accountUtils.shortenAddress({
                address: solanaAccount.account.address,
              }),
              value: solanaAccount.account.address,
            },
          ],
        });
      }

      const btcAccounts = signAccounts.filter(
        (account) => account.network.id === getNetworkIdsMap().btc,
      );
      if (btcAccounts.length > 0) {
        result.push({
          title: 'BTC',
          data: btcAccounts.map((account) => ({
            label: accountUtils.shortenAddress({
              address: account.account.address,
            }),
            value: account.account.address,
            description: account.deriveLabel,
          })),
        });
      }
      return result;
    },
    [accountId, indexedAccountId, isOthersWallet, networkId],
    {
      initResult: [],
    },
  );

  const selectedAddress = form.watch('address');
  const currentSignAccount = useMemo(() => {
    if (!selectedAddress) {
      return undefined;
    }
    return signAccountsRef.current.find(
      (account) => account.account.address === selectedAddress,
    );
  }, [selectedAddress]);

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
          sections={selectOptions}
          defaultTriggerInputProps={{
            leftAddOnProps: {
              size: 'large',
              renderContent: (
                <XStack alignItems="center" px="$1" mr="$-3">
                  <NetworkAvatar
                    networkId={currentSignAccount?.network.id}
                    size="$6"
                  />
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
  const route =
    useRoute<
      RouteProp<
        IModalSignAndVerifyParamList,
        EModalSignAndVerifyRoutes.SignAndVerifyMessage
      >
    >();
  const {
    networkId,
    accountId,
    walletId,
    indexedAccountId,
    deriveInfoItems,
    deriveType,
    isOthersWallet,
  } = route.params;

  useEffect(() => {
    console.log('route.params: ', {
      networkId,
      accountId,
      walletId,
      indexedAccountId,
      deriveInfoItems,
      deriveType,
      isOthersWallet,
    });
  }, [
    accountId,
    deriveInfoItems,
    deriveType,
    indexedAccountId,
    isOthersWallet,
    networkId,
    walletId,
  ]);

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
      return (
        <SignForm
          form={signForm}
          networkId={networkId}
          accountId={accountId}
          indexedAccountId={indexedAccountId}
          isOthersWallet={isOthersWallet}
        />
      );
    }
    return <SizableText>Verify message</SizableText>;
  }, [
    action,
    signForm,
    networkId,
    accountId,
    indexedAccountId,
    isOthersWallet,
  ]);

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
