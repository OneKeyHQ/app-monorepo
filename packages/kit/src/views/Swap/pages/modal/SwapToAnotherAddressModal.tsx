import { memo, useCallback, useEffect } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import type { IPageNavigationProp } from '@onekeyhq/components';
import { Button, Form, Page, useForm } from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import type { IAddressInputValue } from '@onekeyhq/kit/src/components/AddressInput';
import { AddressInput } from '@onekeyhq/kit/src/components/AddressInput';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useSwapToAnotherAccountAddressAtom } from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type {
  EModalSwapRoutes,
  IModalSwapParamList,
} from '@onekeyhq/shared/src/routes/swap';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { ESwapDirectionType } from '@onekeyhq/shared/types/swap/types';

import { useSwapAddressInfo } from '../../hooks/useSwapAccount';
import { withSwapProvider } from '../WithSwapProvider';

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

  const [, setSettings] = useSettingsPersistAtom();
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
                      id: 'form__address_invalid',
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
          id: 'action__confirm',
        })}
        onCancelText={intl.formatMessage({ id: 'action__reset' })}
        onCancel={handleOnCancel}
      />
    </Page>
  ) : (
    <Button
      onPress={() => {
        navigation.pop();
      }}
    >
      no account info please go back
    </Button>
  );
};

const SwapToAnotherAddressPageWithProvider = memo(
  withSwapProvider(SwapToAnotherAddressPage),
);
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
