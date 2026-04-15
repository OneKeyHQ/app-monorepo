import { useCallback, useEffect, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import type { IPageNavigationProp } from '@onekeyhq/components';
import {
  Form,
  Icon,
  Page,
  SizableText,
  XStack,
  useForm,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import type { IAddressInputValue } from '@onekeyhq/kit/src/components/AddressInput';
import { AddressInputField } from '@onekeyhq/kit/src/components/AddressInput';
import { renderAddressSecurityHeaderRightButton } from '@onekeyhq/kit/src/components/AddressInput/AddressSecurityHeaderRightButton';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useSwapManualSelectQuoteProvidersAtom,
  useSwapQuoteCurrentSelectAtom,
  useSwapToAnotherAccountAddressAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { useSettingsAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  EModalSwapRoutes,
  IModalSwapParamList,
} from '@onekeyhq/shared/src/routes/swap';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { ESwapDirectionType } from '@onekeyhq/shared/types/swap/types';

import RecipientQuickSelect from '../../../Send/pages/SendDataInput/RecipientQuickSelect';
import { shouldSkipResolvedRecipientUpdate } from '../../../Send/pages/SendDataInput/recipientSelectionUtils';
import { useSwapAddressInfo } from '../../hooks/useSwapAccount';
import { SwapProviderMirror } from '../SwapProviderMirror';

import type { IRecipientQuickSelectTab } from '../../../Send/pages/SendDataInput/recipientQuickSelectTabUtils';
import type { RouteProp } from '@react-navigation/core';
import type { SubmitHandler } from 'react-hook-form';

const BASE_HIDDEN_TABS: IRecipientQuickSelectTab[] = ['recent'];

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
  const {
    accountInfo,
    address: _address,
    activeAccount,
    networkId,
  } = useSwapAddressInfo(ESwapDirectionType.TO);

  const [{ swapToAnotherAccountSwitchOn }, setSettings] = useSettingsAtom();
  const [, setSwapToAddress] = useSwapToAnotherAccountAddressAtom();
  const [selectedQuote] = useSwapQuoteCurrentSelectAtom();
  const [, setSwapManualSelectQuote] = useSwapManualSelectQuoteProvidersAtom();
  const intl = useIntl();

  // OK-52685: on web dapp mode, only keyless wallet accounts are valid swap
  // recipients — hide the address book tab, and the whole account tab too
  // when the user has no keyless wallet at all.
  const { result: hasKeylessWallet = true } = usePromiseResult(async () => {
    if (!platformEnv.isWebDappMode) return true;
    const { wallets } = await backgroundApiProxy.serviceAccount.getWallets({
      ignoreNonBackedUpWallets: true,
      nestedHiddenWallets: true,
    });
    return wallets.some((w) =>
      accountUtils.isKeylessWallet({ walletId: w.id }),
    );
  }, []);

  const hiddenTabs = useMemo<IRecipientQuickSelectTab[]>(() => {
    if (!platformEnv.isWebDappMode) return BASE_HIDDEN_TABS;
    return hasKeylessWallet
      ? [...BASE_HIDDEN_TABS, 'addressBook']
      : [...BASE_HIDDEN_TABS, 'addressBook', 'account'];
  }, [hasKeylessWallet]);
  const form = useForm({
    defaultValues: {
      address: {
        raw: '',
      } as IAddressInputValue,
    },
    mode: 'onChange',
    reValidateMode: 'onBlur',
  });
  // Only prefill when editing an existing custom address.
  // When swapToAnotherAccountSwitchOn is true and paramAddress differs from
  // the user's own address, the user previously set a custom address — prefill it.
  useEffect(() => {
    if (paramAddress && swapToAnotherAccountSwitchOn) {
      form.setValue('address', { raw: paramAddress });
    }
  }, [paramAddress, swapToAnotherAccountSwitchOn, form]);

  const toAddressRaw = form.watch('address')?.raw ?? '';
  const [hasQuickSelectMatches, setHasQuickSelectMatches] = useState(false);

  const handleQuickSelectRecipient = useCallback(
    ({
      address: selectedAddress,
      quickSelectTab,
      isSearchMode: selectIsSearchMode,
      searchKeyLength: selectSearchKeyLength,
      matchCount: selectMatchCount,
    }: {
      address: string;
      quickSelectTab?: 'recent' | 'account' | 'addressBook';
      isSearchMode?: boolean;
      searchKeyLength?: number;
      matchCount?: number;
    }) => {
      if (!selectedAddress) return;
      const currentTo = form.getValues('address');
      if (shouldSkipResolvedRecipientUpdate({ currentTo, selectedAddress })) {
        return;
      }
      if (quickSelectTab) {
        defaultLogger.transaction.send.quickSelectTap({
          network: networkId,
          tab: quickSelectTab,
          recipientType:
            quickSelectTab === 'account' ? 'walletAccount' : 'addressBook',
          isSearchMode: selectIsSearchMode ?? false,
          searchKeyLength: selectSearchKeyLength ?? 0,
          matchCount: selectMatchCount ?? 0,
        });
      }
      form.setValue('address', {
        raw: selectedAddress,
      } as IAddressInputValue);
    },
    [form, networkId],
  );

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
        accountInfo: activeAccount,
      }));
      setSwapManualSelectQuote(selectedQuote);
      navigation.pop();
    },
    [
      networkId,
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

  return accountInfo && networkId ? (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.address_book_edit_address_title,
        })}
        headerRight={renderAddressSecurityHeaderRightButton}
      />
      <Page.Body px="$5" gap="$1">
        <Form form={form}>
          <AddressInputField
            name="address"
            networkId={networkId}
            actionsLayout="recipient"
            enableAddressBook
            enableWalletName
            enableAddressInteractionStatus
            enableAddressContract
            enableAllowListValidation
            accountId={accountInfo?.account?.id}
            hasQuickSelectMatches={hasQuickSelectMatches}
          />
          <XStack gap="$1.5" alignItems="center">
            <Icon name="InfoCircleOutline" size="$4" color="$iconSubdued" />
            <SizableText flex={1} size="$bodyMd" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.swap_page_recipient_modal_do_not,
              })}
            </SizableText>
          </XStack>
          <RecipientQuickSelect
            accountId={accountInfo?.account?.id ?? ''}
            networkId={networkId}
            senderDeriveType={activeAccount?.deriveType}
            searchKey={toAddressRaw}
            isSearchMode={!!toAddressRaw?.trim()}
            hideTabs={hiddenTabs}
            keylessWalletsOnly={platformEnv.isWebDappMode}
            onMatchStatusChange={setHasQuickSelectMatches}
            onSelect={handleQuickSelectRecipient}
          />
        </Form>
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
