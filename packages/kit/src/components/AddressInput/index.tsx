import type { ComponentProps, FC } from 'react';
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
  useFormContext,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
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
import type {
  IAddressBadge,
  IAddressValidateStatus,
  IQueryCheckAddressArgs,
} from '@onekeyhq/shared/types/address';
import {
  EAddressInteractionStatus,
  EInputAddressChangeType,
} from '@onekeyhq/shared/types/address';

import { AddressBadge } from '../AddressBadge';
import { BaseInput } from '../BaseInput';
import { WalletAvatarById } from '../WalletAvatar';

import { AddressInputContext } from './AddressInputContext';
import { renderAddressInputHyperlinkText } from './AddressInputHyperlinkText';
import { useIsEnableTransferAllowList } from './hooks';
import { ClipboardPlugin } from './plugins/clipboard';
import { ScanPlugin } from './plugins/scan';
import { SelectorPlugin } from './plugins/selector';

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
      <XStack gap="$2" mb="$1" flex={1} flexWrap="wrap">
        {result.walletAccountName ? (
          <Badge badgeType="success" badgeSize="sm">
            <XStack gap="$1.5" alignItems="center">
              {result.walletId ? (
                <WalletAvatarById walletId={result.walletId} size="$4" />
              ) : null}
              <Badge.Text>{result.walletAccountName}</Badge.Text>
            </XStack>
          </Badge>
        ) : null}
        {result.addressBookName ? (
          <Badge badgeType="success" badgeSize="sm">
            <XStack gap="$1.5" alignItems="center">
              <Icon name="BookOpenOutline" size="$4" color="$textSuccess" />
              <Badge.Text>{result.addressBookName}</Badge.Text>
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
        <XStack gap="$1" flexWrap="wrap" flexShrink={1}>
          {result.addressBadges
            ?.filter(
              (badge) => badge.type === 'default' || badge.type === 'info',
            )
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
  const intl = useIntl();
  const isEnableTransferAllowList = useIsEnableTransferAllowList();
  const navigation = useAppNavigation();

  // Interaction badges use semantic types (success/warning/critical),
  // while label badges (OKX, CEX) use "default" or "info" type.
  const interactionBadges = useMemo(
    () =>
      (queryResult?.addressBadges ?? []).filter(
        (badge) => badge.type !== 'default' && badge.type !== 'info',
      ),
    [queryResult?.addressBadges],
  );

  const showAddToAddressBook = useMemo(() => {
    // Don't show if already in address book or wallet
    if (queryResult?.addressBookId || queryResult?.walletAccountId)
      return false;
    // Show for transferred addresses (add to address book guidance)
    if (
      queryResult?.addressInteractionStatus ===
      EAddressInteractionStatus.INTERACTED
    )
      return true;
    // Show for first-transfer addresses when allowlist is enabled
    // (user needs to add to address book to send)
    if (
      isEnableTransferAllowList &&
      queryResult?.addressInteractionStatus ===
        EAddressInteractionStatus.NOT_INTERACTED
    )
      return true;
    return false;
  }, [
    queryResult?.addressBookId,
    queryResult?.walletAccountId,
    queryResult?.addressInteractionStatus,
    isEnableTransferAllowList,
  ]);

  const onAddToAddressBook = useCallback(() => {
    navigation.pushModal(EModalRoutes.AddressBookModal, {
      screen: EModalAddressBookRoutes.EditItemModal,
      params: {
        address: queryResult?.input ?? '',
        networkId,
        isAllowListed: isEnableTransferAllowList,
      },
    });
  }, [isEnableTransferAllowList, navigation, networkId, queryResult?.input]);

  if (interactionBadges.length === 0 && !showAddToAddressBook) return null;

  return (
    <XStack pt="$1.5" gap="$2" alignItems="center" flexWrap="wrap">
      {interactionBadges.map((badge) => (
        <AddressBadge
          key={badge.label}
          title={badge.label}
          badgeType={badge.type}
          content={badge.tip}
          icon={badge.icon}
        />
      ))}
      {showAddToAddressBook ? (
        <Button variant="tertiary" size="small" onPress={onAddToAddressBook}>
          {intl.formatMessage({
            id: ETranslations.add_to_address_book__action,
          })}
        </Button>
      ) : null}
    </XStack>
  );
}

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

  const setResolveAddress = useCallback((text: string) => {
    setQueryResult((prev) => ({ ...prev, resolveAddress: text }));
  }, []);

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
      inputTypeRef.current = inputType;
      if (textRef.current !== text) {
        textRef.current = text;
        setInputText(text);
        onInputTypeChange?.(inputType);
        onChange?.({ raw: text, pending: text?.length > 0 });
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
    async (params: IQueryCheckAddressArgs) => {
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

        const result =
          await backgroundApiProxy.serviceAccountProfile.queryAddress(params);
        if (result.input === textRef.current) {
          setQueryResult(result);
        }
      } catch {
        // Treat unexpected validation errors as an unknown address state.
        if (params.address === textRef.current) {
          setQueryResult({ input: params.address, validStatus: 'unknown' });
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
      ignoreSimilarAddressInAddressBook,
      enableCheckSimilarAddressInAddressBook,
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
    ignoreSimilarAddressInAddressBook,
    enableCheckSimilarAddressInAddressBook,
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
        ignoreSimilarAddressInAddressBook,
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
    ignoreSimilarAddressInAddressBook,
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
        similarAddress: queryResult.similarAddress,
      });
    } else {
      const translationId = getValidateMessage(queryResult.validStatus);
      onChange?.({
        raw: queryResult.input,
        pending: false,
        validateError: {
          type: queryResult.validStatus,
          translationId,
          message: translationId
            ? intl.formatMessage({ id: translationId })
            : undefined,
        },
        isContract: queryResult.isContract,
        similarAddress: queryResult.similarAddress,
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
          variant="secondary"
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
            return (
              <>
                {hasContent ? (
                  clearButton
                ) : (
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
                  </>
                )}
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
        value={inputText}
        onChangeText={(text) =>
          onChangeText({ text, inputType: EInputAddressChangeType.Manual })
        }
        placeholder={placeholder ?? getAddressInputPlaceholder}
        extension={AddressInputExtension}
        numberOfLines={screenWidth <= 768 ? 3 : 2}
        {...(screenWidth <= 768 && { minHeight: 64 })}
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
    hasQuickSelectMatches,
  } = props;
  const hasQuickSelectMatchesRef = useRef(hasQuickSelectMatches);
  hasQuickSelectMatchesRef.current = hasQuickSelectMatches;

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
              // Suppress other errors when quick select has matches (hint shown via description)
              if (hasQuickSelectMatchesRef.current) {
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
