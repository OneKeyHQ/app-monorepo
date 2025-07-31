import type { ComponentProps, FC } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';
import { useDebouncedCallback } from 'use-debounce';

import type { TextArea } from '@onekeyhq/components';
import {
  Badge,
  Form,
  Icon,
  IconButton,
  Select,
  Spinner,
  Stack,
  XStack,
  useFormContext,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { HyperlinkText } from '@onekeyhq/kit/src/components/HyperlinkText';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useRouteIsFocused as useIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import type {
  IAccountDeriveInfo,
  IAccountDeriveTypes,
} from '@onekeyhq/kit-bg/src/vaults/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalAddressBookRoutes } from '@onekeyhq/shared/src/routes/addressBook';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { EAddressInteractionStatus } from '@onekeyhq/shared/types/address';
import type {
  EInputAddressChangeType,
  IAddressBadge,
  IAddressValidateStatus,
  IQueryCheckAddressArgs,
} from '@onekeyhq/shared/types/address';

import { AddressBadge } from '../AddressBadge';
import { BaseInput } from '../BaseInput';

import { AddressInputContext } from './AddressInputContext';
import { renderAddressInputHyperlinkText } from './AddressInputHyperlinkText';
import { useIsEnableTransferAllowList } from './hooks';
import { ClipboardPlugin } from './plugins/clipboard';
import { ScanPlugin } from './plugins/scan';
import { SelectorPlugin } from './plugins/selector';

import type { IScanPluginProps } from './plugins/scan';

type IResolvedAddressProps = {
  value: string;
  options: string[];
  onChange?: (value: string) => void;
};

const ResolvedAddress: FC<IResolvedAddressProps> = ({
  value,
  options,
  onChange,
}) => {
  const intl = useIntl();
  if (options.length <= 1) {
    return (
      <Badge badgeSize="sm">
        <Badge.Text>
          {accountUtils.shortenAddress({
            address: value,
          })}
        </Badge.Text>
      </Badge>
    );
  }
  return (
    <Select
      title={intl.formatMessage({
        id: ETranslations.send_ens_choose_address_title,
      })}
      placeholder={intl.formatMessage({
        id: ETranslations.send_ens_choose_address_title,
      })}
      renderTrigger={() => (
        <Badge badgeSize="sm" userSelect="none">
          <Badge.Text>
            {accountUtils.shortenAddress({
              address: value,
            })}
          </Badge.Text>
          <Icon name="ChevronDownSmallOutline" color="$iconSubdued" size="$4" />
        </Badge>
      )}
      items={options.map((o) => ({ label: o, value: o }))}
      value={value}
      onChange={onChange}
      floatingPanelProps={{
        width: '$80',
      }}
    />
  );
};

export type IAddressInputValue = {
  raw?: string;
  resolved?: string;
  pending?: boolean;
  isContract?: boolean;
  validateError?: {
    type?: Exclude<IAddressValidateStatus, 'valid'>;
    message?: string;
    translationId?: ETranslations;
  };
};

type IAddressInputProps = Omit<
  ComponentProps<typeof TextArea>,
  'value' | 'onChange'
> & {
  networkId: string;
  value?: IAddressInputValue;
  onChange?: (value: IAddressInputValue) => void;
  placeholder?: string;
  name?: string;
  autoError?: boolean;
  // plugins options for control button display
  clipboard?: boolean;
  scan?: { sceneName: EAccountSelectorSceneName };
  contacts?: boolean;
  accountSelector?: {
    num: number;
    onBeforeAccountSelectorOpen?: () => void;
    clearNotMatch?: boolean;
  };

  // query options for control query behavior
  enableNameResolve?: boolean;
  enableAddressBook?: boolean;
  enableWalletName?: boolean;

  accountId?: string;

  enableAddressContract?: boolean;
  enableAddressInteractionStatus?: boolean; // for check address interaction
  enableVerifySendFundToSelf?: boolean; // To verify whether funds can be sent to one's own address.
  enableAllowListValidation?: boolean; // Check address if it is on the allow list.

  onInputTypeChange?: (type: EInputAddressChangeType) => void;
  onExtraDataChange?: ({
    memo,
    note,
  }: {
    memo?: string;
    note?: string;
  }) => void;

  hideNonBackedUpWallet?: boolean;
  onScanResult?: IScanPluginProps['onScanResult'];
};

export type IAddressQueryResult = {
  input?: string;
  validStatus?: IAddressValidateStatus;
  walletAccountName?: string;
  walletAccountId?: string; // accountId or indexedAccountId
  addressBookId?: string;
  addressBookName?: string;
  resolveAddress?: string;
  validAddress?: string;
  resolveOptions?: string[];
  addressInteractionStatus?: EAddressInteractionStatus;
  isContract?: boolean;
  addressLabel?: string;
  isAllowListed?: boolean;
  isEnableTransferAllowList?: boolean;
  isScam?: boolean;
  isCex?: boolean;
  addressBadges?: IAddressBadge[];
  addressDeriveInfo?: IAccountDeriveInfo;
  addressDeriveType?: IAccountDeriveTypes;
  addressNote?: string;
  addressMemo?: string;
};

type IAddressInputBadgeGroupProps = {
  loading?: boolean;
  result?: IAddressQueryResult;
  setResolveAddress?: (address: string) => void;
  onRefresh?: () => void;
  networkId: string;
};

function AddressInputBadgeGroup(props: IAddressInputBadgeGroupProps) {
  const { loading, result, setResolveAddress, onRefresh } = props;
  if (loading) {
    return <Spinner />;
  }
  if (result?.validStatus === 'unknown') {
    return (
      <IconButton
        variant="tertiary"
        icon="RotateClockwiseSolid"
        size="small"
        onPress={onRefresh}
      />
    );
  }
  if (result) {
    return (
      <XStack gap="$2" my="$-1" flex={1} flexWrap="wrap">
        {result.walletAccountName ? (
          <Badge badgeType="success" badgeSize="sm" mx="$0.5">
            {result.walletAccountName}
          </Badge>
        ) : null}
        {result.addressBookName ? (
          <Badge badgeType="success" badgeSize="sm" mx="$0.5">
            {result.addressBookName}
          </Badge>
        ) : null}
        {result.resolveAddress ? (
          <Stack mx="$0.5">
            <ResolvedAddress
              value={result.resolveAddress}
              options={result.resolveOptions ?? []}
              onChange={setResolveAddress}
            />
          </Stack>
        ) : null}
        <XStack mx="$0.5" gap="$1" flexWrap="wrap" flexShrink={1}>
          {result.addressBadges?.map((badge) => (
            <AddressBadge
              key={badge.label}
              title={badge.label}
              badgeType={badge.type}
              content={badge.tip}
              icon={badge.icon}
            />
          ))}
        </XStack>
      </XStack>
    );
  }
  return null;
}

export const createValidateAddressRule =
  ({ defaultErrorMessage }: { defaultErrorMessage: string }) =>
  (value: IAddressInputValue) => {
    if (value.pending) {
      return;
    }
    if (!value.resolved) {
      return value.validateError?.message ?? defaultErrorMessage;
    }
    return undefined;
  };

function AddressInputWarnings({
  queryResult,
  networkId,
}: {
  queryResult: IAddressQueryResult;
  networkId: string;
}) {
  const isEnableTransferAllowList = useIsEnableTransferAllowList();

  const isShowTransferredAddressAddWarning = useMemo(
    () =>
      !isEnableTransferAllowList &&
      queryResult?.input?.length &&
      !queryResult?.addressBookId &&
      !queryResult?.walletAccountId &&
      queryResult?.addressInteractionStatus ===
        EAddressInteractionStatus.INTERACTED,
    [
      isEnableTransferAllowList,
      queryResult?.addressBookId,
      queryResult?.addressInteractionStatus,
      queryResult?.input?.length,
      queryResult?.walletAccountId,
    ],
  );
  const navigation = useAppNavigation();
  const onAction = useCallback(
    (actionId: string) => {
      if (actionId === 'to_edit_address_book_page') {
        navigation.pushModal(EModalRoutes.AddressBookModal, {
          screen: EModalAddressBookRoutes.EditItemModal,
          params: {
            address: queryResult?.input ?? '',
            networkId,
            isAllowListed: isEnableTransferAllowList,
          },
        });
      }
    },
    [isEnableTransferAllowList, navigation, networkId, queryResult?.input],
  );
  return isShowTransferredAddressAddWarning ? (
    <HyperlinkText
      pt="$1.5"
      translationId={ETranslations.send_transferred_address_add}
      onAction={onAction}
      color="$textSubdued"
      size="$bodyMd"
    />
  ) : null;
}

export function AddressInput(props: IAddressInputProps) {
  const {
    name = '',
    value,
    onChange,
    networkId,
    placeholder,
    clipboard = true,
    scan = { sceneName: EAccountSelectorSceneName.home },
    contacts,
    accountSelector,
    enableNameResolve = true,
    enableAddressBook,
    enableWalletName,
    accountId,
    enableAddressInteractionStatus,
    enableAddressContract,
    enableVerifySendFundToSelf,
    enableAllowListValidation,
    onInputTypeChange,
    onExtraDataChange,
    disabled: disabledFromProps,
    onScanResult,
    ...rest
  } = props;
  const intl = useIntl();
  const disabled =
    disabledFromProps ?? (rest.editable !== undefined ? !rest.editable : false);
  const [inputText, setInputText] = useState<string>(value?.raw ?? '');
  const { setError, clearErrors, watch } = useFormContext();
  const [loading, setLoading] = useState(false);
  const textRef = useRef('');
  const rawAddress = watch([name, 'raw'].join('.'));

  const [queryResult, setQueryResult] = useState<IAddressQueryResult>({});
  const [refreshNum, setRefreshNum] = useState(1);

  const setResolveAddress = useCallback((text: string) => {
    setQueryResult((prev) => ({ ...prev, resolveAddress: text }));
  }, []);

  const onChangeText = useCallback(
    (text: string) => {
      if (textRef.current !== text) {
        textRef.current = text;
        setInputText(text);
        onChange?.({ raw: text, pending: text.length > 0 });
      }
    },
    [onChange],
  );

  const onRefresh = useCallback(() => setRefreshNum((prev) => prev + 1), []);

  useEffect(() => {
    if (rawAddress && textRef.current !== rawAddress) {
      onChangeText(rawAddress);
    }
  }, [rawAddress, onChangeText]);

  const queryAddress = useDebouncedCallback(
    async (params: IQueryCheckAddressArgs) => {
      if (!params.address) {
        setQueryResult({});
        return;
      }
      setLoading(true);
      try {
        const result =
          await backgroundApiProxy.serviceAccountProfile.queryAddress(params);
        if (result.input === textRef.current) {
          setQueryResult(result);
        }
      } finally {
        setLoading(false);
      }
    },
    300,
  );

  // Query address validation when text changes
  useEffect(() => {
    void queryAddress({
      address: inputText,
      networkId,
      accountId,
      enableAddressBook,
      enableAddressInteractionStatus,
      enableNameResolve,
      enableWalletName,
      enableVerifySendFundToSelf,
      enableAddressContract,
      enableAllowListValidation,
    });
  }, [
    inputText,
    networkId,
    accountId,
    enableNameResolve,
    enableAddressBook,
    enableWalletName,
    enableAddressInteractionStatus,
    enableAddressContract,
    enableVerifySendFundToSelf,
    enableAllowListValidation,
    refreshNum,
    queryAddress,
  ]);

  // When focus state changes, re-query address validation
  // Store previous focus state for comparison
  const prevIsFocused = useRef<boolean | undefined>(undefined);
  const isFocused = useIsFocused();
  useEffect(() => {
    if (
      prevIsFocused.current !== undefined &&
      prevIsFocused.current !== isFocused
    ) {
      void queryAddress({
        address: inputText,
        networkId,
        accountId,
        enableAddressBook,
        enableAddressInteractionStatus,
        enableNameResolve,
        enableWalletName,
        enableVerifySendFundToSelf,
        enableAddressContract,
        enableAllowListValidation,
      });
    }
    prevIsFocused.current = isFocused;
  }, [
    inputText,
    networkId,
    accountId,
    enableNameResolve,
    enableAddressBook,
    enableWalletName,
    enableAddressInteractionStatus,
    enableAddressContract,
    enableVerifySendFundToSelf,
    enableAllowListValidation,
    refreshNum,
    queryAddress,
    isFocused,
  ]);

  const getValidateMessage = useCallback(
    (status?: Exclude<IAddressValidateStatus, 'valid'>) => {
      if (!status) return;
      const message: Record<
        Exclude<IAddressValidateStatus, 'valid'>,
        ETranslations
      > = {
        'unknown': ETranslations.send_check_request_error,
        'prohibit-send-to-self': ETranslations.send_cannot_send_to_self,
        'invalid': ETranslations.send_address_invalid,
        'address-not-allowlist': ETranslations.send_address_not_allowlist_error,
      } as const;
      return message[status];
    },
    [],
  );

  useEffect(() => {
    if (Object.keys(queryResult).length === 0) return;
    if (queryResult.validStatus === 'valid') {
      clearErrors(name);
      onChange?.({
        raw: queryResult.input,
        resolved:
          queryResult.resolveAddress ??
          queryResult.validAddress ??
          queryResult.input?.trim(),
        pending: false,
        isContract: queryResult.isContract,
      });
    } else {
      const translationId = getValidateMessage(queryResult.validStatus);
      onChange?.({
        raw: queryResult.input,
        pending: false,
        validateError: {
          type: queryResult.validStatus,
          translationId,
          message: intl.formatMessage({ id: translationId }),
        },
        isContract: queryResult.isContract,
      });
    }
  }, [
    queryResult,
    intl,
    clearErrors,
    setError,
    name,
    onChange,
    getValidateMessage,
  ]);

  const AddressInputExtension = useMemo(
    () => (
      <XStack
        justifyContent="space-between"
        flexWrap="nowrap"
        alignItems="center"
      >
        <XStack gap="$2" flex={1}>
          <AddressInputBadgeGroup
            loading={loading}
            result={queryResult}
            setResolveAddress={setResolveAddress}
            onRefresh={onRefresh}
            networkId={networkId}
          />
        </XStack>
        <XStack gap="$6">
          {clipboard ? (
            <ClipboardPlugin
              onInputTypeChange={onInputTypeChange}
              onChange={onChangeText}
              disabled={disabled}
              testID={rest.testID ? `${rest.testID}-clip` : undefined}
            />
          ) : null}
          {scan ? (
            <ScanPlugin
              networkId={networkId}
              onInputTypeChange={onInputTypeChange}
              onScanResult={onScanResult}
              onChange={onChangeText}
              disabled={disabled}
              testID={rest.testID ? `${rest.testID}-scan` : undefined}
            />
          ) : null}
          {contacts || accountSelector ? (
            <SelectorPlugin
              disabled={disabled}
              onInputTypeChange={onInputTypeChange}
              onChange={onChangeText}
              networkId={networkId}
              accountId={accountId}
              num={accountSelector?.num}
              currentAddress={inputText}
              clearNotMatch={accountSelector?.clearNotMatch}
              onBeforeAccountSelectorOpen={
                accountSelector?.onBeforeAccountSelectorOpen
              }
              onExtraDataChange={onExtraDataChange}
              testID={rest.testID ? `${rest.testID}-selector` : undefined}
            />
          ) : null}
        </XStack>
      </XStack>
    ),
    [
      loading,
      queryResult,
      setResolveAddress,
      onRefresh,
      networkId,
      clipboard,
      onInputTypeChange,
      onChangeText,
      disabled,
      rest.testID,
      scan,
      onScanResult,
      contacts,
      accountSelector,
      accountId,
      inputText,
      onExtraDataChange,
    ],
  );

  const getAddressInputPlaceholder = useMemo(() => {
    if (networkUtils.isLightningNetworkByNetworkId(networkId)) {
      return intl.formatMessage({
        id: ETranslations.form_recipient_ln_placeholder,
      });
    }

    return intl.formatMessage({ id: ETranslations.send_to_placeholder });
  }, [intl, networkId]);

  return (
    <>
      <BaseInput
        value={inputText}
        onChangeText={onChangeText}
        placeholder={placeholder ?? getAddressInputPlaceholder}
        extension={AddressInputExtension}
        {...rest}
      />
      <AddressInputWarnings queryResult={queryResult} networkId={networkId} />
    </>
  );
}

export function AddressInputField(
  props: IAddressInputProps & { name: string },
) {
  const intl = useIntl();
  const {
    enableAllowListValidation,
    networkId,
    accountId,
    name,
    hideNonBackedUpWallet,
  } = props;
  const contextValue = useMemo(
    () => ({
      name,
      networkId,
      accountId,
      hideNonBackedUpWallet,
    }),
    [accountId, hideNonBackedUpWallet, name, networkId],
  );

  return (
    <AddressInputContext.Provider value={contextValue}>
      <Form.Field
        label={intl.formatMessage({ id: ETranslations.global_recipient })}
        name={name}
        renderErrorMessage={
          enableAllowListValidation
            ? renderAddressInputHyperlinkText
            : undefined
        }
        rules={{
          required: true,
          validate: (value: IAddressInputValue) => {
            if (value.pending) {
              return;
            }
            if (!value.resolved) {
              return enableAllowListValidation
                ? // Use translationId for error message formatting if available, otherwise use direct message
                  value.validateError?.translationId ||
                    value.validateError?.message ||
                    intl.formatMessage({
                      id: ETranslations.send_address_invalid,
                    })
                : value.validateError?.message ||
                    intl.formatMessage({
                      id: ETranslations.send_address_invalid,
                    });
            }
          },
        }}
      >
        <AddressInput {...props} />
      </Form.Field>
    </AddressInputContext.Provider>
  );
}
