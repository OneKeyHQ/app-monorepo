import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useDebouncedCallback } from 'use-debounce';

import type { IAddressQueryResult } from '@onekeyhq/kit/src/components/AddressInput';
import {
  getAddressQueryResolvedAddress,
  getAddressValidateTranslationId,
  queryAddressWithFallback,
} from '@onekeyhq/kit/src/components/AddressInput/utils';
import type { IAccountSelectorActiveAccountInfo } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useSwapToAnotherAccountAddressAtom } from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { useSettingsAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

type IUseSwapIncognitoRecipientInputParams = {
  visible: boolean;
  validationEnabled: boolean;
  clearRecipientAddressOnHide?: boolean;
  networkId?: string;
  accountId?: string;
  accountInfo?: IAccountSelectorActiveAccountInfo;
  address?: string;
  swapToAnotherAccountSwitchOn: boolean;
};

type IShouldBlockSwapActionForIncognitoRecipientInputParams = {
  inputText: string;
  isConnectWalletAction: boolean;
  loading: boolean;
  queryResult: Pick<IAddressQueryResult, 'validStatus'>;
  validationEnabled: boolean;
  visible: boolean;
};

type IShouldEnableSwapIncognitoRecipientValidationParams = {
  hasFromToken: boolean;
  hasToToken: boolean;
  isAddressInfoReady: boolean;
  networkId?: string;
  providerSupportsRecipient: boolean;
  visible: boolean;
};

type IShouldShowSwapIncognitoRecipientInputParams = {
  incognitoMode: boolean;
  providerSupportsRecipient: boolean;
  swapType: ESwapTabSwitchType;
};

type IAddressValidationContext = {
  accountId?: string;
  enabled: boolean;
  networkId?: string;
  queryText: string;
  validationSessionId: number;
};

function isSameAddressValidationContext(
  left: IAddressValidationContext,
  right: IAddressValidationContext,
) {
  return (
    left.accountId === right.accountId &&
    left.enabled === right.enabled &&
    left.networkId === right.networkId &&
    left.queryText === right.queryText &&
    left.validationSessionId === right.validationSessionId
  );
}

export function shouldBlockSwapActionForIncognitoRecipientInput({
  inputText,
  isConnectWalletAction,
  loading,
  queryResult,
  validationEnabled,
  visible,
}: IShouldBlockSwapActionForIncognitoRecipientInputParams) {
  if (isConnectWalletAction) {
    return false;
  }

  if (!visible || !inputText.trim()) {
    return false;
  }

  if (!validationEnabled || loading) {
    return true;
  }

  return queryResult.validStatus !== 'valid';
}

export function shouldEnableSwapIncognitoRecipientValidation({
  hasFromToken,
  hasToToken,
  isAddressInfoReady,
  networkId,
  providerSupportsRecipient,
  visible,
}: IShouldEnableSwapIncognitoRecipientValidationParams) {
  return Boolean(
    visible &&
    providerSupportsRecipient &&
    hasFromToken &&
    hasToToken &&
    networkId &&
    isAddressInfoReady,
  );
}

export function shouldShowSwapIncognitoRecipientInput({
  incognitoMode,
  providerSupportsRecipient,
  swapType,
}: IShouldShowSwapIncognitoRecipientInputParams) {
  return Boolean(
    incognitoMode &&
    providerSupportsRecipient &&
    swapType !== ESwapTabSwitchType.LIMIT &&
    swapType !== ESwapTabSwitchType.STOCK,
  );
}

export function useSwapIncognitoRecipientInput({
  visible,
  validationEnabled,
  clearRecipientAddressOnHide,
  networkId,
  accountId,
  accountInfo,
  address,
  swapToAnotherAccountSwitchOn,
}: IUseSwapIncognitoRecipientInputParams) {
  const [, setSettings] = useSettingsAtom();
  const [, setSwapToAddress] = useSwapToAnotherAccountAddressAtom();
  const [inputText, setInputText] = useState('');
  const [queryResult, setQueryResult] = useState<IAddressQueryResult>({});
  const [loading, setLoading] = useState(false);
  const textRef = useRef('');
  const skipExternalSyncRef = useRef<string | null>(null);
  const validationSessionIdRef = useRef(0);
  const validationContextRef = useRef<IAddressValidationContext>({
    accountId,
    enabled: false,
    networkId,
    queryText: '',
    validationSessionId: validationSessionIdRef.current,
  });
  const validationScopeRef = useRef<{
    accountId?: string;
    networkId?: string;
  }>({
    accountId,
    networkId,
  });

  const enabled = visible && validationEnabled && !!networkId;
  const validatedInputRef = useRef<
    | {
        networkId: string;
        queryText: string;
      }
    | undefined
  >(undefined);

  validationContextRef.current = {
    accountId,
    enabled,
    networkId,
    queryText: inputText.trim(),
    validationSessionId: validationSessionIdRef.current,
  };

  const syncRecipientAddress = useCallback(
    (nextAddress?: string) => {
      skipExternalSyncRef.current = nextAddress ?? '';

      setSettings((settings) => ({
        ...settings,
        swapToAnotherAccountSwitchOn: Boolean(nextAddress),
      }));

      setSwapToAddress((value) => {
        let nextAccountInfo: IAccountSelectorActiveAccountInfo | undefined;

        if (nextAddress) {
          if (accountInfo) {
            nextAccountInfo = {
              ...accountInfo,
            };
          } else if (value.address === nextAddress) {
            nextAccountInfo = value.accountInfo;
          }
        }

        return {
          ...value,
          networkId: nextAddress ? networkId : undefined,
          address: nextAddress,
          accountInfo: nextAccountInfo,
        };
      });
    },
    [accountInfo, networkId, setSettings, setSwapToAddress],
  );

  const queryAddress = useDebouncedCallback(async (currentText: string) => {
    const requestContext = {
      accountId,
      enabled,
      networkId,
      queryText: currentText,
      validationSessionId: validationSessionIdRef.current,
    };

    if (!requestContext.enabled || !requestContext.networkId) {
      return;
    }

    if (!currentText) {
      if (
        isSameAddressValidationContext(
          requestContext,
          validationContextRef.current,
        )
      ) {
        validatedInputRef.current = undefined;
        setLoading(false);
        setQueryResult({});
      }
      return;
    }

    setLoading(true);
    try {
      const result = await queryAddressWithFallback({
        address: currentText,
        networkId: requestContext.networkId,
        accountId: requestContext.accountId,
        enableAddressBook: true,
        enableWalletName: true,
        enableAddressInteractionStatus: true,
        enableAddressContract: true,
        enableAllowListValidation: true,
      });

      if (
        !isSameAddressValidationContext(
          requestContext,
          validationContextRef.current,
        )
      ) {
        return;
      }

      setQueryResult(result);

      if (result.validStatus === 'valid') {
        const resolvedAddress = getAddressQueryResolvedAddress(result);

        if (resolvedAddress) {
          validatedInputRef.current = {
            networkId: requestContext.networkId,
            queryText: requestContext.queryText,
          };
          syncRecipientAddress(resolvedAddress);
          return;
        }
      }

      validatedInputRef.current = undefined;
      syncRecipientAddress(undefined);
    } finally {
      if (
        isSameAddressValidationContext(
          requestContext,
          validationContextRef.current,
        )
      ) {
        setLoading(false);
      }
    }
  }, 300);

  const resetValidationState = useCallback(
    ({
      clearInput = false,
      clearRecipientAddress = false,
    }: {
      clearInput?: boolean;
      clearRecipientAddress?: boolean;
    } = {}) => {
      validationSessionIdRef.current += 1;
      queryAddress.cancel();
      setLoading(false);
      setQueryResult({});

      if (clearInput) {
        validatedInputRef.current = undefined;
        textRef.current = '';
        setInputText('');
      }

      if (clearRecipientAddress) {
        syncRecipientAddress(undefined);
      }
    },
    [queryAddress, syncRecipientAddress],
  );

  useEffect(() => {
    if (!visible) {
      validationScopeRef.current = {
        accountId,
        networkId,
      };
      resetValidationState({
        clearInput: true,
        clearRecipientAddress: clearRecipientAddressOnHide,
      });
      return;
    }

    if (!enabled) {
      validationScopeRef.current = {
        accountId,
        networkId,
      };
      resetValidationState({
        clearRecipientAddress: true,
      });
      return;
    }

    const prevScope = validationScopeRef.current;
    const nextScope = {
      accountId,
      networkId,
    };
    const validatedInput = validatedInputRef.current;
    const isValidatedNetworkChanged =
      validatedInput?.queryText === textRef.current.trim() &&
      validatedInput.networkId !== nextScope.networkId;

    validationScopeRef.current = nextScope;

    if (
      prevScope.accountId === nextScope.accountId &&
      prevScope.networkId === nextScope.networkId &&
      !isValidatedNetworkChanged
    ) {
      return;
    }

    resetValidationState({
      clearInput: isValidatedNetworkChanged,
      clearRecipientAddress: true,
    });
  }, [
    accountId,
    clearRecipientAddressOnHide,
    enabled,
    networkId,
    resetValidationState,
    visible,
  ]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const nextText = swapToAnotherAccountSwitchOn && address ? address : '';
    const skipExternalSyncText = skipExternalSyncRef.current;

    if (skipExternalSyncText !== null) {
      skipExternalSyncRef.current = null;
      if (skipExternalSyncText === nextText) {
        return;
      }
    }

    if (textRef.current === nextText) {
      return;
    }

    textRef.current = nextText;
    validatedInputRef.current = undefined;
    setInputText(nextText);
    setQueryResult({});
  }, [address, enabled, swapToAnotherAccountSwitchOn]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    void queryAddress(inputText.trim());
  }, [accountId, enabled, inputText, networkId, queryAddress]);

  useEffect(() => () => queryAddress.cancel(), [queryAddress]);

  const handleInputChange = useCallback(
    (text: string) => {
      const nextText = stringUtils.stripLineBreaks(text);
      const trimmedNextText = nextText.trim();

      if (textRef.current === nextText) {
        if (!enabled) {
          return;
        }

        const shouldKeepCurrentValidation =
          !trimmedNextText ||
          (queryResult.validStatus === 'valid' &&
            swapToAnotherAccountSwitchOn &&
            !!address);

        if (shouldKeepCurrentValidation) {
          return;
        }

        validationSessionIdRef.current += 1;
        queryAddress.cancel();
        setLoading(true);
        setQueryResult({});
        syncRecipientAddress(undefined);
        void queryAddress(trimmedNextText);
        return;
      }

      validatedInputRef.current = undefined;
      textRef.current = nextText;
      setInputText(nextText);
      setQueryResult({});
      syncRecipientAddress(undefined);
    },
    [
      address,
      enabled,
      queryAddress,
      queryResult.validStatus,
      swapToAnotherAccountSwitchOn,
      syncRecipientAddress,
    ],
  );

  const errorTranslationId = useMemo(() => {
    if (!inputText.trim() || loading || queryResult.validStatus === 'valid') {
      return undefined;
    }

    if (!queryResult.validStatus) {
      return undefined;
    }

    const translationId =
      getAddressValidateTranslationId(queryResult.validStatus) ??
      ETranslations.send_address_invalid;

    return translationId;
  }, [inputText, loading, queryResult.validStatus]);

  return {
    enabled,
    errorTranslationId,
    inputText,
    loading,
    onInputChange: handleInputChange,
    queryResult,
  };
}
