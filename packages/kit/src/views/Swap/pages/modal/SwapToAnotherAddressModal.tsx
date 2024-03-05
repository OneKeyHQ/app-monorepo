import { memo, useCallback, useEffect, useMemo } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import type { IPageNavigationProp } from '@onekeyhq/components';
import { Button, Form, Page, useForm } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IAddressInputValue } from '@onekeyhq/kit/src/common/components/AddressInput';
import {
  AddressInput,
  allAddressInputPlugins,
} from '@onekeyhq/kit/src/common/components/AddressInput';
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

interface IFormType {
  address: IAddressInputValue;
}

const SwapToAnotherAddressPage = () => {
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSwapParamList>>();

  const route =
    useRoute<
      RouteProp<IModalSwapParamList, EModalSwapRoutes.SwapTokenSelect>
    >();
  const type = useMemo(
    () => route.params?.type ?? ESwapDirectionType.FROM,
    [route.params?.type],
  );
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
    if (address) {
      form.setValue('address', { raw: address });
    }
  }, [address, form]);

  const handleOnCreateAddress = useCallback(async () => {
    if (!accountInfo) return;
    await backgroundApiProxy.serviceAccount.addHDOrHWAccounts({
      walletId: accountInfo.wallet?.id,
      indexedAccountId: accountInfo.indexedAccount?.id,
      deriveType: accountInfo.deriveType,
      networkId: accountInfo.network?.id,
    });
  }, [accountInfo]);

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
      <Page.Body px="$5">
        <Button onPress={handleOnCreateAddress} variant="tertiary">{`Create ${
          accountInfo.network?.name ?? 'unknown'
        } address for ${accountInfo.wallet?.name ?? 'unknown'} - ${
          accountInfo.accountName
        }`}</Button>
        {type === ESwapDirectionType.TO ? (
          <>
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
          </>
        ) : null}
      </Page.Body>
      {type === ESwapDirectionType.TO ? (
        <Page.Footer
          onConfirm={() => form.handleSubmit(handleOnConfirm)()}
          onConfirmText={intl.formatMessage({
            id: 'action__confirm',
          })}
        />
      ) : null}
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
