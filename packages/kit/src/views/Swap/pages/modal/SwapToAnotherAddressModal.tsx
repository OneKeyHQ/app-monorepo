import { useCallback, useEffect, useMemo } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import type { IPageNavigationProp } from '@onekeyhq/components';
import {
  Form,
  Icon,
  Page,
  SizableText,
  Stack,
  XStack,
  useForm,
} from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import type { IAddressInputValue } from '@onekeyhq/kit/src/components/AddressInput';
import { AddressInput } from '@onekeyhq/kit/src/components/AddressInput';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useSwapToAnotherAccountAddressAtom } from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { useSettingsAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalSwapRoutes,
  IModalSwapParamList,
} from '@onekeyhq/shared/src/routes/swap';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { ESwapDirectionType } from '@onekeyhq/shared/types/swap/types';

import { useSwapAddressInfo } from '../../hooks/useSwapAccount';
import { SwapProviderMirror } from '../SwapProviderMirror';

import type { RouteProp } from '@react-navigation/core';
import type { SubmitHandler } from 'react-hook-form';

interface IFormType {
  address: IAddressInputValue;
}

const SwapToAnotherAddressPage = () => {
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSwapParamList>>();

  const route =
    useRoute<
      RouteProp<IModalSwapParamList, EModalSwapRoutes.SwapToAnotherAddress>
    >();
  const paramAddress = route.params?.address;
  const { accountInfo, address, activeAccount } = useSwapAddressInfo(
    ESwapDirectionType.TO,
  );

  const [, setSettings] = useSettingsAtom();
  const [, setSwapToAddress] = useSwapToAnotherAccountAddressAtom();
  const intl = useIntl();
  const form = useForm({
    defaultValues: {
      address: {
        raw: '',
      } as IAddressInputValue,
    },
    mode: 'onChange',
    reValidateMode: 'onBlur',
  });
  useEffect(() => {
    if (address && accountInfo?.account?.address === address) {
      form.setValue('address', { raw: address });
    } else if (paramAddress) {
      form.setValue('address', { raw: paramAddress });
    }
  }, [accountInfo?.account?.address, address, form, paramAddress]);

  const handleOnOpenAccountSelector = useCallback(() => {
    setSettings((v) => ({
      ...v,
      swapToAnotherAccountSwitchOn: true,
    }));
  }, [setSettings]);

  const handleOnConfirm: SubmitHandler<IFormType> = useCallback(
    (data) => {
      const finallyAddress = data.address.resolved;
      if (!finallyAddress) return;
      setSettings((v) => ({
        ...v,
        swapToAnotherAccountSwitchOn: true,
      }));
      setSwapToAddress((v) => ({
        ...v,
        address: finallyAddress,
        networkId: activeAccount?.network?.id,
        accountInfo: activeAccount,
      }));
      navigation.pop();
    },
    [activeAccount, navigation, setSettings, setSwapToAddress],
  );

  const handleOnCancel = useCallback(() => {
    setSettings((v) => ({
      ...v,
      swapToAnotherAccountSwitchOn: false,
    }));
    setSwapToAddress((v) => ({ ...v, address: undefined }));
  }, [setSwapToAddress, setSettings]);

  const accountSelector = useMemo(
    () => ({
      num: 1,
      onBeforeAccountSelectorOpen: handleOnOpenAccountSelector,
    }),
    [handleOnOpenAccountSelector],
  );

  return accountInfo && accountInfo?.network?.id ? (
    <Page scrollEnabled>
      <Page.Body px="$5" gap="$6">
        <Form form={form}>
          <Form.Field
            label={intl.formatMessage({ id: ETranslations.global_recipient })}
            name="address"
            rules={{
              required: true,
              validate: (value: IAddressInputValue) => {
                if (value.pending) {
                  return;
                }
                if (!value.resolved) {
                  return (
                    value.validateError?.message ??
                    intl.formatMessage({
                      id: ETranslations.send_address_invalid,
                    })
                  );
                }
              },
            }}
          >
            <AddressInput
              networkId={accountInfo?.network?.id}
              enableAddressBook
              enableWalletName
              accountId={accountInfo?.account?.id}
              contacts
              accountSelector={accountSelector}
            />
          </Form.Field>
        </Form>
        <Stack gap="$4">
          <XStack>
            <Stack
              $md={{
                pt: '$0.5',
              }}
            >
              <Icon name="CheckRadioOutline" size="$5" color="$iconSuccess" />
            </Stack>
            <SizableText
              flex={1}
              pl="$2"
              size="$bodyLg"
              color="$textSubdued"
              $gtMd={{
                size: '$bodyMd',
              }}
            >
              {intl.formatMessage({
                id: ETranslations.swap_page_recipient_modal_verify,
              })}
            </SizableText>
          </XStack>
          <XStack>
            <Stack
              $md={{
                pt: '$0.5',
              }}
            >
              <Icon name="BlockOutline" size="$5" color="$iconCritical" />
            </Stack>
            <SizableText
              flex={1}
              pl="$2"
              size="$bodyLg"
              color="$textSubdued"
              $gtMd={{
                size: '$bodyMd',
              }}
            >
              {intl.formatMessage({
                id: ETranslations.swap_page_recipient_modal_do_not,
              })}
            </SizableText>
          </XStack>
        </Stack>
      </Page.Body>
      <Page.Footer
        onConfirm={() => form.handleSubmit(handleOnConfirm)()}
        onConfirmText={intl.formatMessage({
          id: ETranslations.global_confirm,
        })}
        onCancelText={intl.formatMessage({
          id: ETranslations.swap_account_to_address_edit_button,
        })}
        onCancel={handleOnCancel}
      />
    </Page>
  ) : null;
};

const SwapToAnotherAddressPageWithProvider = () => {
  const route =
    useRoute<
      RouteProp<IModalSwapParamList, EModalSwapRoutes.SwapToAnotherAddress>
    >();
  const { storeName } = route.params;
  return (
    <SwapProviderMirror storeName={storeName}>
      <SwapToAnotherAddressPage />
    </SwapProviderMirror>
  );
};

export default function SwapToAnotherAddressPageModal() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.swap,
      }}
      enabledNum={[0, 1]}
    >
      <SwapToAnotherAddressPageWithProvider />
    </AccountSelectorProviderMirror>
  );
}
