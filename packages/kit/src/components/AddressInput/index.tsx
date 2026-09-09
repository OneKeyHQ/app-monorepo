import type { ComponentProps, FC, ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';
import { useWindowDimensions } from 'react-native';
import { useDebouncedCallback } from 'use-debounce';

import type { TextArea } from '@onekeyhq/components';
import {
  Badge,
  Button,
  Form,
  Icon,
  IconButton,
  Select,
  SizableText,
  Spinner,
  Stack,
  XStack,
} from '@onekeyhq/components';
import { useFormContext } from '@onekeyhq/components/src/hooks/useForm';
import { useRouteIsFocused as useIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import type {
  IAccountDeriveInfo,
  IAccountDeriveTypes,
} from '@onekeyhq/kit-bg/src/vaults/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import {
  type EAddressInteractionStatus,
  EInputAddressChangeType,
  type IAddressBadge,
  type IAddressValidateStatus,
  type ICexSupportedInfo,
  type IQueryCheckAddressArgs,
} from '@onekeyhq/shared/types/address';

import { AddressBadge } from '../AddressBadge';
import { BaseInput } from '../BaseInput';
import { WalletAvatarById } from '../WalletAvatar';

import { AddressInputContext } from './AddressInputContext';
import { renderAddressInputHyperlinkText } from './AddressInputHyperlinkText';
import { AddressInputWarnings } from './AddressInputWarnings';
import { ClipboardPlugin } from './plugins/clipboard';
import { ScanPlugin } from './plugins/scan';
import { SelectorPlugin } from './plugins/selector';
import {
  getAddressQueryResolvedAddress,
  getAddressValidateTranslationId,
  queryAddressWithFallback,
} from './utils';

import type { IScanPluginProps } from './plugins/scan';
import type { IAccountSelectorActiveAccountInfo } from '../../states/jotai/contexts/accountSelector';

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
      testID="address-input-intl-select"
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
  similarAddress?: string;
  cexSupportedInfo?: ICexSupportedInfo;
};

type IAddressInputActionsLayout = 'default' | 'recipient';

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
  actionsLayout?: IAddressInputActionsLayout;
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
  ignoreSimilarAddressInAddressBook?: boolean;
  enableCheckSimilarAddressInAddressBook?: boolean;
  onScanResult?: IScanPluginProps['onScanResult'];
  hasQuickSelectMatches?: boolean;
  tokenAddress?: string;
};

export type IAddressQueryResult = {
  input?: string;
  validStatus?: IAddressValidateStatus;
  walletName?: string;
  accountName?: string;
  walletAccountName?: string;
  walletAccountId?: string; // accountId or indexedAccountId
  walletId?: string;
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
  similarAddress?: string;
  cexSupportedInfo?: ICexSupportedInfo;
};

type IAddressInputBadgeGroupProps = {
  loading?: boolean;
  result?: IAddressQueryResult;
  setResolveAddress?: (address: string) => void;
  onRefresh?: () => void;
  networkId: string;
};

type IResolvedAddressQueryContext = {
  input: string;
  resolveAddress: string;
  resolveOptions: string[];
};

function AddressInputBadgeGroup(props: IAddressInputBadgeGroupProps) {
  const { loading, result, setResolveAddress, onRefresh } = props;
  if (loading) {
    return <Spinner />;
  }
  if (result?.validStatus === 'unknown') {
    return (
      <IconButton
        testID="address-input-refresh-btn"
        variant="tertiary"
        icon="RotateClockwiseSolid"
        size="small"
        onPress={onRefresh}
      />
    );
  }
  if (result) {
    return (
      <XStack gap="$2" mb="$1" flex={1} flexWrap="wrap" overflow="hidden">
        {result.walletAccountName ? (
          <Badge badgeType="success" badgeSize="sm" maxWidth="100%">
            <XStack gap="$1.5" alignItems="center" maxWidth="100%">
              {result.walletId ? (
                <WalletAvatarById walletId={result.walletId} size="$4" />
              ) : null}
              <Badge.Text numberOfLines={1}>
                {result.walletAccountName}
              </Badge.Text>
            </XStack>
          </Badge>
        ) : null}
        {result.addressBookName ? (
          <Badge badgeType="success" badgeSize="sm" maxWidth="100%">
            <XStack gap="$1.5" alignItems="center" maxWidth="100%">
              <Icon name="BookOpenOutline" size="$4" color="$textSuccess" />
              <Badge.Text numberOfLines={1}>
                {result.addressBookName}
              </Badge.Text>
            </XStack>
          </Badge>
        ) : null}
        {result.resolveAddress ? (
          <Stack>
            <ResolvedAddress
              value={result.resolveAddress}
              options={result.resolveOptions ?? []}
              onChange={setResolveAddress}
            />
          </Stack>
        ) : null}
        {/* Label badges (OKX, CEX, etc.) stay inside the input.
            Interaction badges (Transferred, First transfer) are rendered
            below the input by AddressInputWarnings. */}
        {result.addressBadges
          ?.filter((badge) => badge.type === 'default' || badge.type === 'info')
          .map((badge) => (
            <AddressBadge
              key={badge.label}
              title={badge.label}
              badgeType={badge.type}
              content={badge.tip}
              icon={badge.icon}
            />
          ))}
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
    // Empty input is the pristine / cleared state — don't surface an
    // "invalid address" message here. Callers must gate their submit
    // button on `value.resolved` (or equivalent) since the form will
    // now report isValid=true for empty input.
    if (!value.raw?.trim()) {
      return;
    }
    if (!value.resolved) {
      return value.validateError?.message ?? defaultErrorMessage;
    }
    return undefined;
  };

export function AddressInput(props: IAddressInputProps) {
  const {
    name = '',
    value,
    onChange,
    networkId,
    placeholder,
    actionsLayout = 'default',
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
    ignoreSimilarAddressInAddressBook,
    enableCheckSimilarAddressInAddressBook,
    hasQuickSelectMatches: _hasQuickSelectMatches,
    tokenAddress,
    ...rest
  } = props;
  const intl = useIntl();
  const { width: screenWidth } = useWindowDimensions();
  const disabled =
    disabledFromProps ?? (rest.editable !== undefined ? !rest.editable : false);
  const { testID } = rest;
  const [inputText, setInputText] = useState<string>(value?.raw ?? '');
  const { setError, clearErrors, watch } = useFormContext();
  const [loading, setLoading] = useState(false);
  const textRef = useRef('');
  const fieldValue = watch(name);
  const rawAddress = fieldValue?.raw;

  const [queryResult, setQueryResult] = useState<IAddressQueryResult>({});
  const [refreshNum, setRefreshNum] = useState(1);

  const walletItemRef = useRef<
    | {
        walletName: string;
        accountName: string;
        accountId: string;
      }
    | undefined
  >(undefined);

  const inputTypeRef = useRef<EInputAddressChangeType | undefined>(undefined);
  const queryContextRef = useRef({ networkId, accountId, tokenAddress });
  queryContextRef.current = { networkId, accountId, tokenAddress };
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const hasAppliedQueryContextRef = useRef(false);
  const selectedResolveAddressRef = useRef<string | undefined>(undefined);

  const handleActiveAccountChange = useCallback(
    (activeAccount: IAccountSelectorActiveAccountInfo) => {
      if (activeAccount.wallet && activeAccount.account) {
        walletItemRef.current = {
          walletName: activeAccount.wallet.name,
          accountName: activeAccount.account.name,
          accountId: activeAccount.account.id,
        };
      }
    },
    [],
  );

  const onChangeText = useCallback(
    ({
      text,
      inputType,
    }: {
      text: string;
      inputType: EInputAddressChangeType;
    }) => {
      const normalizedText = stringUtils.stripLineBreaks(text);
      inputTypeRef.current = inputType;
      if (textRef.current !== normalizedText) {
        selectedResolveAddressRef.current = undefined;
        textRef.current = normalizedText;
        setInputText(normalizedText);
        setQueryResult({});
        onInputTypeChange?.(inputType);
        onChange?.({
          raw: normalizedText,
          pending: normalizedText.length > 0,
        });
      }
    },
    [onChange, onInputTypeChange],
  );

  const onRefresh = useCallback(() => setRefreshNum((prev) => prev + 1), []);

  useEffect(() => {
    if (rawAddress && textRef.current !== rawAddress) {
      onChangeText({
        text: rawAddress,
        inputType: EInputAddressChangeType.Manual,
      });
    }
  }, [rawAddress, onChangeText]);

  const queryAddress = useDebouncedCallback(
    async (
      params: IQueryCheckAddressArgs,
      resolvedAddressContext?: IResolvedAddressQueryContext,
    ) => {
      if (!params.address) {
        setQueryResult({});
        return;
      }
      setLoading(true);
      try {
        if (
          walletItemRef.current &&
          inputTypeRef.current === EInputAddressChangeType.AccountSelector
        ) {
          params.walletAccountItem = walletItemRef.current;
        } else {
          walletItemRef.current = undefined;
          inputTypeRef.current = undefined;
        }

        const queryResultResp = await queryAddressWithFallback(params);
        const result = resolvedAddressContext
          ? { ...queryResultResp, ...resolvedAddressContext }
          : queryResultResp;
        const currentQueryContext = queryContextRef.current;
        if (
          result.input === textRef.current &&
          params.networkId === currentQueryContext.networkId &&
          params.accountId === currentQueryContext.accountId &&
          params.tokenAddress === currentQueryContext.tokenAddress &&
          (!resolvedAddressContext ||
            selectedResolveAddressRef.current ===
              resolvedAddressContext.resolveAddress)
        ) {
          setQueryResult(result);
        }
      } finally {
        setLoading(false);
      }
    },
    300,
  );

  const buildQueryAddressParams = useCallback(
    (): IQueryCheckAddressArgs => ({
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
      ignoreSimilarAddressInAddressBook,
      enableCheckSimilarAddressInAddressBook,
      tokenAddress,
    }),
    [
      accountId,
      enableAddressBook,
      enableAddressContract,
      enableAddressInteractionStatus,
      enableAllowListValidation,
      enableCheckSimilarAddressInAddressBook,
      enableNameResolve,
      enableVerifySendFundToSelf,
      enableWalletName,
      ignoreSimilarAddressInAddressBook,
      inputText,
      networkId,
      tokenAddress,
    ],
  );

  const setResolveAddress = useCallback(
    (resolveAddress: string) => {
      const input = textRef.current;
      const resolveOptions = queryResult.resolveOptions ?? [];
      selectedResolveAddressRef.current = resolveAddress;
      setQueryResult({});
      onChangeRef.current?.({ raw: input, pending: true });
      void queryAddress(
        {
          ...buildQueryAddressParams(),
          address: resolveAddress,
          enableNameResolve: false,
        },
        { input, resolveAddress, resolveOptions },
      );
    },
    [buildQueryAddressParams, queryAddress, queryResult.resolveOptions],
  );

  useEffect(() => {
    if (!hasAppliedQueryContextRef.current) {
      hasAppliedQueryContextRef.current = true;
      return;
    }
    if (!textRef.current) {
      return;
    }
    // Drop stale validation while the new account/network/token request runs.
    setQueryResult({});
    onChangeRef.current?.({
      raw: textRef.current,
      pending: true,
    });
  }, [accountId, networkId, tokenAddress]);

  // Query address validation when text changes
  useEffect(() => {
    void queryAddress(buildQueryAddressParams());
  }, [buildQueryAddressParams, queryAddress, refreshNum]);

  // When focus state changes, re-query address validation
  // Store previous focus state for comparison
  const prevIsFocused = useRef<boolean | undefined>(undefined);
  const isFocused = useIsFocused();
  useEffect(() => {
    if (
      prevIsFocused.current !== undefined &&
      prevIsFocused.current !== isFocused
    ) {
      void queryAddress(buildQueryAddressParams());
    }
    prevIsFocused.current = isFocused;
  }, [buildQueryAddressParams, isFocused, queryAddress, refreshNum]);

  useEffect(() => {
    if (Object.keys(queryResult).length === 0) return;
    const nextValue = {
      raw: queryResult.input,
      pending: false,
      isContract: queryResult.isContract,
      similarAddress: queryResult.similarAddress,
      cexSupportedInfo: queryResult.cexSupportedInfo,
    };
    if (queryResult.validStatus === 'valid') {
      clearErrors(name);
      onChange?.({
        ...nextValue,
        resolved: getAddressQueryResolvedAddress(queryResult),
      });
    } else {
      const translationId = getAddressValidateTranslationId(
        queryResult.validStatus,
      );
      onChange?.({
        ...nextValue,
        validateError: {
          type: queryResult.validStatus,
          translationId,
          message: translationId
            ? intl.formatMessage({ id: translationId })
            : undefined,
        },
      });
    }
  }, [queryResult, intl, clearErrors, setError, name, onChange]);

  const handleClear = useCallback(() => {
    onChangeText({ text: '', inputType: EInputAddressChangeType.Manual });
  }, [onChangeText]);

  const AddressInputExtension = useMemo(() => {
    const isRecipientLayout = actionsLayout === 'recipient';
    const hasContent = inputText.trim().length > 0;
    const actionDisplay = isRecipientLayout ? 'button' : 'icon';
    const actionGap = isRecipientLayout ? '$2' : '$6';
    const showSelector = !isRecipientLayout && (contacts || accountSelector);

    const clearButton =
      actionDisplay === 'button' ? (
        <Button
          size="small"
          variant="secondary"
          icon="BroomOutline"
          disabled={disabled}
          onPress={disabled ? undefined : handleClear}
          testID={testID ? `${testID}-clear` : undefined}
        >
          {intl.formatMessage({ id: ETranslations.global_clear })}
        </Button>
      ) : (
        <IconButton
          title={intl.formatMessage({ id: ETranslations.global_clear })}
          variant="tertiary"
          icon="BroomOutline"
          disabled={disabled}
          onPress={disabled ? undefined : handleClear}
          testID={testID ? `${testID}-clear` : undefined}
        />
      );

    return (
      <XStack
        justifyContent="space-between"
        flexWrap="nowrap"
        alignItems={isRecipientLayout ? 'flex-end' : 'center'}
        gap="$2"
      >
        <XStack gap="$2" flex={1} minWidth={0}>
          <AddressInputBadgeGroup
            loading={loading}
            result={queryResult}
            setResolveAddress={setResolveAddress}
            onRefresh={onRefresh}
            networkId={networkId}
          />
        </XStack>
        <XStack gap={actionGap}>
          {(() => {
            if (isRecipientLayout) {
              return hasContent ? (
                clearButton
              ) : (
                <>
                  {scan ? (
                    <ScanPlugin
                      display={actionDisplay}
                      networkId={networkId}
                      onScanResult={onScanResult}
                      onChange={onChangeText}
                      disabled={disabled}
                      testID={testID ? `${testID}-scan` : undefined}
                    />
                  ) : null}
                  {clipboard ? (
                    <ClipboardPlugin
                      display={actionDisplay}
                      onChange={onChangeText}
                      disabled={disabled}
                      testID={testID ? `${testID}-clip` : undefined}
                    />
                  ) : null}
                </>
              );
            }
            // Default layout: empty state shows the action cluster
            // (clipboard / scan / account selector). Non-empty state collapses
            // to the clear button alone — the selector is hidden so it
            // doesn't float next to committed address content (OK-53255,
            // matching the recipient layout used by the Send flow).
            if (hasContent) {
              return clearButton;
            }
            return (
              <>
                {clipboard ? (
                  <ClipboardPlugin
                    display={actionDisplay}
                    onChange={onChangeText}
                    disabled={disabled}
                    testID={testID ? `${testID}-clip` : undefined}
                  />
                ) : null}
                {scan ? (
                  <ScanPlugin
                    display={actionDisplay}
                    networkId={networkId}
                    onScanResult={onScanResult}
                    onChange={onChangeText}
                    disabled={disabled}
                    testID={testID ? `${testID}-scan` : undefined}
                  />
                ) : null}
                {showSelector ? (
                  <SelectorPlugin
                    disabled={disabled}
                    onChange={onChangeText}
                    onActiveAccountChange={handleActiveAccountChange}
                    networkId={networkId}
                    accountId={accountId}
                    num={accountSelector?.num}
                    currentAddress={inputText}
                    clearNotMatch={accountSelector?.clearNotMatch}
                    onBeforeAccountSelectorOpen={
                      accountSelector?.onBeforeAccountSelectorOpen
                    }
                    onExtraDataChange={onExtraDataChange}
                    testID={testID ? `${testID}-selector` : undefined}
                  />
                ) : null}
              </>
            );
          })()}
        </XStack>
      </XStack>
    );
  }, [
    loading,
    queryResult,
    setResolveAddress,
    onRefresh,
    networkId,
    clipboard,
    onChangeText,
    disabled,
    testID,
    scan,
    onScanResult,
    contacts,
    accountSelector,
    handleActiveAccountChange,
    accountId,
    inputText,
    onExtraDataChange,
    actionsLayout,
    handleClear,
    intl,
  ]);

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
        {...rest}
        value={inputText}
        onChangeText={(text) =>
          onChangeText({ text, inputType: EInputAddressChangeType.Manual })
        }
        placeholder={placeholder ?? getAddressInputPlaceholder}
        extension={AddressInputExtension}
        numberOfLines={screenWidth <= 768 ? 3 : 2}
        {...(screenWidth <= 768 && { minHeight: 64 })}
      />
      <AddressInputWarnings queryResult={queryResult} networkId={networkId} />
    </>
  );
}

export function AddressInputField({
  labelAddon,
  ...props
}: IAddressInputProps & { name: string; labelAddon?: ReactNode }) {
  const intl = useIntl();
  const {
    enableAllowListValidation,
    networkId,
    accountId,
    name,
    hideNonBackedUpWallet,
    hasQuickSelectMatches,
  } = props;
  const { trigger, watch } = useFormContext();
  const toValue = watch(name) as IAddressInputValue | undefined;

  // Re-validate when match status changes to toggle error/hint
  useEffect(() => {
    if (!toValue?.raw?.trim()) {
      return;
    }
    void trigger(name);
  }, [hasQuickSelectMatches, trigger, name, toValue?.raw]);

  const contextValue = useMemo(
    () => ({
      name,
      networkId,
      accountId,
      hideNonBackedUpWallet,
    }),
    [accountId, hideNonBackedUpWallet, name, networkId],
  );

  // Show hint when: has matches, has input, not resolved, not pending
  const showHint =
    hasQuickSelectMatches &&
    !!toValue?.raw?.trim() &&
    !toValue?.resolved &&
    !toValue?.pending;

  const hintDescription = showHint ? (
    <SizableText size="$bodyMd" pt="$1.5" color="$textSubdued">
      {intl.formatMessage({
        id: ETranslations.msg__enter_a_full_address_or_choose_below,
      })}
    </SizableText>
  ) : undefined;

  return (
    <AddressInputContext.Provider value={contextValue}>
      <Form.Field
        label={intl.formatMessage({ id: ETranslations.global_recipient })}
        labelAddon={labelAddon}
        name={name}
        description={hintDescription}
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
            // When input is empty, treat as "no error" (no red border).
            // The Next button is already hidden via toResolved check.
            if (!value.raw?.trim()) {
              return;
            }
            if (!value.resolved) {
              // Always show critical errors regardless of quick-select state
              if (
                value.validateError?.type === 'address-not-allowlist' ||
                value.validateError?.type === 'prohibit-send-to-self'
              ) {
                return (
                  value.validateError.translationId ||
                  value.validateError.message ||
                  intl.formatMessage({
                    id: ETranslations.send_address_invalid,
                  })
                );
              }
              // When quick select has matches, keep generic validation errors
              // hidden and show the contextual hint text instead.
              if (hasQuickSelectMatches) {
                return;
              }
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
