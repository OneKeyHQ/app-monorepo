import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';
import { useDebouncedCallback } from 'use-debounce';

import type { IAddressQueryResult } from '@onekeyhq/kit/src/components/AddressInput';
import {
  getAddressQueryResolvedAddress,
  getAddressValidateTranslationId,
  queryAddressWithFallback,
} from '@onekeyhq/kit/src/components/AddressInput/utils';
import { useSwapToAnotherAccountAddressAtom } from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { useSettingsAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

type IUseSwapIncognitoRecipientInputParams = {
  visible: boolean;
  clearRecipientAddressOnHide?: boolean;
  networkId?: string;
  accountId?: string;
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
  address,
  swapToAnotherAccountSwitchOn,
}: IUseSwapIncognitoRecipientInputParams) {
  const intl = useIntl();
  const [, setSettings] = useSettingsAtom();
  const [, setSwapToAddress] = useSwapToAnotherAccountAddressAtom();
  const [inputText, setInputText] = useState('');
  const [queryResult, setQueryResult] = useState<IAddressQueryResult>({});
  const [loading, setLoading] = useState(false);
  const textRef = useRef('');
  const skipExternalSyncRef = useRef(false);
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
      skipExternalSyncRef.current = true;

      setSettings((settings) => ({
        ...settings,
        swapToAnotherAccountSwitchOn: Boolean(nextAddress),
      }));

      setSwapToAddress((value) => ({
        ...value,
        networkId: nextAddress ? networkId : undefined,
        address: nextAddress,
        accountInfo:
          nextAddress && value.address === nextAddress
            ? value.accountInfo
            : undefined,
      }));
    },
    [networkId, setSettings, setSwapToAddress],
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

    resetValidationState({
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

    if (skipExternalSyncRef.current) {
      skipExternalSyncRef.current = false;
      if (textRef.current === nextText) {
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

      if (textRef.current === nextText) {
        return;
      }

      textRef.current = nextText;
      setInputText(nextText);
      setQueryResult({});
      syncRecipientAddress(undefined);
    },
    [syncRecipientAddress],
  );

  const errorMessage = useMemo(() => {
    if (!inputText.trim() || loading || queryResult.validStatus === 'valid') {
      return undefined;
    }

    if (!queryResult.validStatus) {
      return undefined;
    }

    const translationId =
      getAddressValidateTranslationId(queryResult.validStatus) ??
      ETranslations.send_address_invalid;

    return intl.formatMessage({
      id: translationId,
    });
  }, [inputText, intl, loading, queryResult.validStatus]);

  return {
    enabled,
    errorMessage,
    inputText,
    loading,
    onInputChange: handleInputChange,
    queryResult,
  };
}
