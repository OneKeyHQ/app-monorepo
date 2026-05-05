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

type IUseSwapIncognitoRecipientInputParams = {
  visible: boolean;
  clearRecipientAddressOnHide?: boolean;
  networkId?: string;
  accountId?: string;
  accountInfo?: IAccountSelectorActiveAccountInfo;
  address?: string;
  swapToAnotherAccountSwitchOn: boolean;
};

type IShouldBlockSwapActionForIncognitoRecipientInputParams = {
  enabled: boolean;
  inputText: string;
  loading: boolean;
  queryResult: Pick<IAddressQueryResult, 'validStatus'>;
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
  enabled,
  inputText,
  loading,
  queryResult,
}: IShouldBlockSwapActionForIncognitoRecipientInputParams) {
  if (!enabled || !inputText.trim()) {
    return false;
  }

  if (loading) {
    return true;
  }

  return queryResult.validStatus !== 'valid';
}

export function useSwapIncognitoRecipientInput({
  visible,
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

  const enabled = visible && !!networkId;

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
          syncRecipientAddress(resolvedAddress);
        }
        return;
      }

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
    if (!enabled) {
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

    const prevScope = validationScopeRef.current;
    const nextScope = {
      accountId,
      networkId,
    };

    validationScopeRef.current = nextScope;

    if (
      prevScope.accountId === nextScope.accountId &&
      prevScope.networkId === nextScope.networkId
    ) {
      return;
    }

    const isNetworkChanged = prevScope.networkId !== nextScope.networkId;

    resetValidationState({
      clearInput: isNetworkChanged,
      clearRecipientAddress: true,
    });
  }, [
    accountId,
    clearRecipientAddressOnHide,
    enabled,
    networkId,
    resetValidationState,
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

      textRef.current = nextText;
      setInputText(nextText);
      setQueryResult({});
      syncRecipientAddress(undefined);
    },
    [
      address,
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
