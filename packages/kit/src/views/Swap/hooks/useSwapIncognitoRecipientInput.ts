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
  networkId?: string;
  accountId?: string;
  address?: string;
  swapToAnotherAccountSwitchOn: boolean;
};

export function useSwapIncognitoRecipientInput({
  visible,
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

  const enabled = visible && !!networkId;

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

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (skipExternalSyncRef.current) {
      skipExternalSyncRef.current = false;
      return;
    }

    const nextText = swapToAnotherAccountSwitchOn && address ? address : '';

    if (textRef.current === nextText) {
      return;
    }

    textRef.current = nextText;
    setInputText(nextText);
    setQueryResult({});
  }, [address, enabled, swapToAnotherAccountSwitchOn]);

  const queryAddress = useDebouncedCallback(async (currentText: string) => {
    if (!networkId) {
      return;
    }

    if (!currentText) {
      setLoading(false);
      setQueryResult({});
      return;
    }

    setLoading(true);
    try {
      const result = await queryAddressWithFallback({
        address: currentText,
        networkId,
        accountId,
        enableAddressBook: true,
        enableWalletName: true,
        enableAddressInteractionStatus: true,
        enableAddressContract: true,
        enableAllowListValidation: true,
      });

      if (result.input === textRef.current) {
        setQueryResult(result);
      }
    } finally {
      setLoading(false);
    }
  }, 300);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    void queryAddress(inputText.trim());
  }, [enabled, inputText, queryAddress]);

  useEffect(() => {
    if (!enabled || queryResult.validStatus !== 'valid') {
      return;
    }

    const resolvedAddress = getAddressQueryResolvedAddress(queryResult);

    if (resolvedAddress) {
      syncRecipientAddress(resolvedAddress);
    }
  }, [enabled, queryResult, syncRecipientAddress]);

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
