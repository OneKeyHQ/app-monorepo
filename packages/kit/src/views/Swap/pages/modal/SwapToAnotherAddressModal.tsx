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
import { AddressInputField } from '@onekeyhq/kit/src/components/AddressInput';
import { renderAddressSecurityHeaderRightButton } from '@onekeyhq/kit/src/components/AddressInput/AddressSecurityHeaderRightButton';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  useSwapManualSelectQuoteProvidersAtom,
  useSwapQuoteCurrentSelectAtom,
  useSwapToAnotherAccountAddressAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
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
  const [selectedQuote] = useSwapQuoteCurrentSelectAtom();
  const [, setSwapManualSelectQuote] = useSwapManualSelectQuoteProvidersAtom();
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
    }
  }, [accountInfo?.account?.address, address, form]);

  useEffect(() => {
    if (paramAddress) {
      form.setValue('address', { raw: paramAddress });
    }
  }, [paramAddress, form]);

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
      setSwapManualSelectQuote(selectedQuote);
      navigation.pop();
    },
    [
      activeAccount,
      navigation,
      selectedQuote,
      setSettings,
      setSwapManualSelectQuote,
      setSwapToAddress,
    ],
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
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.address_book_edit_address_title,
        })}
        headerRight={renderAddressSecurityHeaderRightButton}
      />
      <Page.Body px="$5" gap="$6">
        <Form form={form}>
          <AddressInputField
            name="address"
            networkId={accountInfo?.network?.id}
            enableAddressBook
            enableWalletName
            // enableVerifySendFundToSelf
            enableAddressInteractionStatus
            enableAddressContract
            enableAllowListValidation
            accountId={accountInfo?.account?.id}
            contacts
            accountSelector={accountSelector}
          />
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
        confirmButtonProps={{
          disabled: !form.formState.isValid,
        }}
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
