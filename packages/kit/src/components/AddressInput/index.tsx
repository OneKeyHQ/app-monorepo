import {
  type ComponentProps,
  type FC,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useFormContext } from 'react-hook-form';
import { useIntl } from 'react-intl';
import { useDebouncedCallback } from 'use-debounce';

import type { TextArea } from '@onekeyhq/components';
import {
  Badge,
  Icon,
  IconButton,
  Popover,
  Select,
  SizableText,
  Spinner,
  Stack,
  XStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type {
  EInputAddressChangeType,
  IAddressInteractionStatus,
  IAddressValidateStatus,
  IQueryCheckAddressArgs,
} from '@onekeyhq/shared/types/address';

import { usePromiseResult } from '../../hooks/usePromiseResult';
import { BaseInput } from '../BaseInput';

import { ClipboardPlugin } from './plugins/clipboard';
import { ScanPlugin } from './plugins/scan';
import { SelectorPlugin } from './plugins/selector';

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

type IAddressInteractionStatusProps = {
  status?: IAddressInteractionStatus;
  networkId: string;
};

const AddressInteractionStatus: FC<IAddressInteractionStatusProps> = ({
  status,
  networkId,
}) => {
  const intl = useIntl();
  const { result } = usePromiseResult(
    () => backgroundApiProxy.serviceNetwork.getNetworkSafe({ networkId }),
    [networkId],
  );
  if (status === 'not-interacted') {
    return (
      <Popover
        placement="bottom-start"
        title={intl.formatMessage({
          id: ETranslations.send_label_first_transfer,
        })}
        renderTrigger={
          <Badge badgeType="warning" badgeSize="sm">
            {intl.formatMessage({
              id: ETranslations.send_label_first_transfer,
            })}
          </Badge>
        }
        renderContent={() => (
          <Stack gap="$4" p="$4">
            <SizableText size="$bodyMd">
              {intl.formatMessage(
                {
                  id: ETranslations.address_input_first_transfer_popover,
                },
                { network: result?.name ?? '' },
              )}
            </SizableText>
          </Stack>
        )}
      />
    );
  }
  if (status === 'interacted') {
    return (
      <Popover
        placement="bottom-start"
        title={intl.formatMessage({
          id: ETranslations.send_label_transferred,
        })}
        renderTrigger={
          <Badge badgeType="success" badgeSize="sm">
            {intl.formatMessage({ id: ETranslations.send_label_transferred })}
          </Badge>
        }
        renderContent={() => (
          <Stack gap="$4" p="$4">
            <SizableText size="$bodyMd">
              {intl.formatMessage({
                id: ETranslations.address_input_transferred_popover,
              })}
            </SizableText>
          </Stack>
        )}
      />
    );
  }
  return null;
};

const AddressContractStatus = ({ isContract }: { isContract?: boolean }) => {
  const intl = useIntl();
  return isContract ? (
    <Popover
      title={intl.formatMessage({ id: ETranslations.global_contract })}
      placement="bottom-start"
      renderTrigger={
        <Badge badgeType="critical" badgeSize="sm">
          {intl.formatMessage({ id: ETranslations.global_contract })}
        </Badge>
      }
      renderContent={() => (
        <Stack gap="$4" p="$4">
          <SizableText size="$bodyMd">
            {intl.formatMessage({
              id: ETranslations.address_input_contract_popover,
            })}
          </SizableText>
        </Stack>
      )}
    />
  ) : null;
};

export type IAddressInputValue = {
  raw?: string;
  resolved?: string;
  pending?: boolean;
  isContract?: boolean;
  validateError?: {
    type?: Exclude<IAddressValidateStatus, 'valid'>;
    message?: string;
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

  onInputTypeChange?: (type: EInputAddressChangeType) => void;
};

export type IAddressQueryResult = {
  input?: string;
  validStatus?: IAddressValidateStatus;
  walletAccountName?: string;
  addressBookName?: string;
  resolveAddress?: string;
  resolveOptions?: string[];
  addressInteractionStatus?: IAddressInteractionStatus;
  isContract?: boolean;
};

type IAddressInputBadgeGroupProps = {
  loading?: boolean;
  result?: IAddressQueryResult;
  setResolveAddress?: (address: string) => void;
  onRefresh?: () => void;
  networkId: string;
};

function AddressInputBadgeGroup(props: IAddressInputBadgeGroupProps) {
  const { loading, result, setResolveAddress, onRefresh, networkId } = props;
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
          <Badge badgeType="success" badgeSize="sm" my="$0.5">
            {result.walletAccountName}
          </Badge>
        ) : null}
        {result.addressBookName ? (
          <Badge badgeType="success" badgeSize="sm" my="$0.5">
            {result.addressBookName}
          </Badge>
        ) : null}
        {result.resolveAddress ? (
          <Stack my="$0.5">
            <ResolvedAddress
              value={result.resolveAddress}
              options={result.resolveOptions ?? []}
              onChange={setResolveAddress}
            />
          </Stack>
        ) : null}
        <XStack my="$0.5" gap="$1">
          <AddressInteractionStatus
            status={result.addressInteractionStatus}
            networkId={networkId}
          />
          <AddressContractStatus isContract={result.isContract} />
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
    onInputTypeChange,
    ...rest
  } = props;
  const intl = useIntl();
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
    refreshNum,
    queryAddress,
  ]);

  const getValidateMessage = useCallback(
    (status?: Exclude<IAddressValidateStatus, 'valid'>) => {
      if (!status) return;
      const message: Record<
        Exclude<IAddressValidateStatus, 'valid'>,
        string
      > = {
        'unknown': intl.formatMessage({
          id: ETranslations.send_check_request_error,
        }),
        'prohibit-send-to-self': intl.formatMessage({
          id: ETranslations.send_cannot_send_to_self,
        }),
        'invalid': intl.formatMessage({
          id: ETranslations.send_address_invalid,
        }),
      };
      return message[status];
    },
    [intl],
  );

  useEffect(() => {
    if (Object.keys(queryResult).length === 0) return;
    if (queryResult.validStatus === 'valid') {
      clearErrors(name);
      onChange?.({
        raw: queryResult.input,
        resolved: queryResult.resolveAddress ?? queryResult.input?.trim(),
        pending: false,
        isContract: queryResult.isContract,
      });
    } else {
      onChange?.({
        raw: queryResult.input,
        pending: false,
        validateError: {
          type: queryResult.validStatus,
          message: getValidateMessage(queryResult.validStatus),
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
              testID={`${rest.testID ?? ''}-clip`}
            />
          ) : null}
          {scan ? (
            <ScanPlugin
              onInputTypeChange={onInputTypeChange}
              sceneName={scan.sceneName}
              onChange={onChangeText}
              testID={`${rest.testID ?? ''}-scan`}
            />
          ) : null}
          {contacts || accountSelector ? (
            <SelectorPlugin
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
              testID={`${rest.testID ?? ''}-selector`}
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
      clipboard,
      onInputTypeChange,
      onChangeText,
      rest.testID,
      scan,
      contacts,
      accountSelector,
      networkId,
      accountId,
      inputText,
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
    <BaseInput
      value={inputText}
      onChangeText={onChangeText}
      placeholder={placeholder ?? getAddressInputPlaceholder}
      extension={AddressInputExtension}
      {...rest}
    />
  );
}
