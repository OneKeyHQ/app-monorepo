import { useCallback, useEffect } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import type { IPageNavigationProp } from '@onekeyhq/components';
import { Form, Page, useForm } from '@onekeyhq/components';
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
  const { accountInfo, networkId, address } = useSwapAddressInfo(
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
    if (address && address !== paramAddress) {
      form.setValue('address', { raw: address });
    }
  }, [address, form, paramAddress]);

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
        networkId,
        accountInfo,
      }));
      navigation.pop();
    },
    [accountInfo, navigation, networkId, setSettings, setSwapToAddress],
  );

  const handleOnCancel = useCallback(() => {
    setSettings((v) => ({
      ...v,
      swapToAnotherAccountSwitchOn: false,
    }));
  }, [setSettings]);

  return accountInfo && accountInfo?.network?.id ? (
    <Page>
      <Page.Body px="$5" space="$4">
        <Form form={form}>
          <Form.Field
            label="Enter a address"
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
              contacts
              accountSelector={{
                num: 1,
                onBeforeAccountSelectorOpen: handleOnOpenAccountSelector,
              }}
            />
          </Form.Field>
        </Form>
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
