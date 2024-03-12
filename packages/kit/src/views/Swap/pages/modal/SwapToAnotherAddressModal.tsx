import { memo, useCallback, useEffect } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import type { IPageNavigationProp } from '@onekeyhq/components';
import { Button, Form, Page, useForm } from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAccountSelectorActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useSwapToAnotherAccountAddressAtom } from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { ESwapDirectionType } from '@onekeyhq/shared/types/swap/types';

import { useSwapAddressInfo } from '../../hooks/uswSwapAccount';
import { withSwapProvider } from '../WithSwapProvider';

import type { EModalSwapRoutes, IModalSwapParamList } from '../../router/types';
import type { RouteProp } from '@react-navigation/core';
import type { SubmitHandler } from 'react-hook-form';
import {
  AddressInput,
  IAddressInputValue,
  allAddressInputPlugins,
} from '@onekeyhq/kit/src/components/AddressInput';

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
  const actions = useAccountSelectorActions();
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
    void actions.current.showAccountSelector({
      activeWallet: accountInfo?.wallet,
      num: 1,
      navigation,
      sceneName: EAccountSelectorSceneName.swap,
    });
  }, [accountInfo?.wallet, actions, navigation, setSettings]);

  const handleOnConfirm: SubmitHandler<IFormType> = useCallback(
    (data) => {
      const finallyAddress = data.address.resolved;
      if (!finallyAddress) return;
      setSwapToAddress((v) => ({
        ...v,
        address: finallyAddress,
        networkId,
        accountInfo,
      }));
      navigation.pop();
    },
    [accountInfo, navigation, networkId, setSwapToAddress],
  );

  return accountInfo && accountInfo?.network?.id ? (
    <Page>
      <Page.Body px="$5" space="$4">
        <Button
          mt="$4"
          onPress={handleOnOpenAccountSelector}
          variant="tertiary"
        >
          Select Another Account
        </Button>
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
                  return intl.formatMessage({
                    id: 'form__address_invalid',
                  });
                }
              },
            }}
          >
            <AddressInput
              networkId={accountInfo?.network?.id}
              enableAddressBook
              plugins={allAddressInputPlugins}
            />
          </Form.Field>
        </Form>
      </Page.Body>
      <Page.Footer
        onConfirm={() => form.handleSubmit(handleOnConfirm)()}
        onConfirmText={intl.formatMessage({
          id: 'action__confirm',
        })}
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
