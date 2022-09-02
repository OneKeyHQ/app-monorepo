/* eslint-disable @typescript-eslint/no-non-null-assertion */
import React, {
  FC,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useIntl } from 'react-intl';

import { Box, Icon, Select, Spinner, Typography } from '@onekeyhq/components';
import { LocaleIds } from '@onekeyhq/components/src/locale';
import type { SelectGroupItem } from '@onekeyhq/components/src/Select';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useDebounce } from '@onekeyhq/kit/src/hooks';

type NameServiceState = {
  isSearching: boolean;
  isValidName: boolean;
  options: SelectGroupItem<string>[];
  errorMessage?: string;
  length?: number;
  activeAddress: string;
  shownSymbol?: string;
};

type NameServiceResolverProps = {
  name: string;
  disableBTC?: boolean;
  networkId?: string;
  onChange?: (state: NameServiceState) => void;
};

export const useNameServiceStatus = () => {
  const [state, setState] = useState<NameServiceState>();

  const buildDisableStatus = useMemo(() => {
    if (!state?.isValidName) return false;
    if (state?.isSearching) return true;
    if (state?.errorMessage) return true;
  }, [state?.isSearching, state?.isValidName, state?.errorMessage]);

  return useMemo(
    () => ({
      onChange: setState,
      address: state?.activeAddress,
      disableSubmitBtn: buildDisableStatus,
    }),
    [state?.activeAddress, buildDisableStatus],
  );
};

const NameServiceResolver: FC<NameServiceResolverProps> = ({
  name: nameInput,
  onChange,
  disableBTC,
  networkId,
}) => {
  const name = useDebounce(nameInput, 500);
  const intl = useIntl();
  const { serviceNameResolver } = backgroundApiProxy;
  const [resolverState, handleResolverState] = useState<NameServiceState>({
    isSearching: false,
    isValidName: false,
    length: 0,
    options: [],
    activeAddress: '',
    shownSymbol: '',
  });

  const setResolverState = useCallback(
    (cb: (v: NameServiceState) => NameServiceState) => {
      handleResolverState((prev) => {
        const newState = cb(prev);
        onChange?.(newState);
        return newState;
      });
    },
    [onChange, handleResolverState],
  );

  const checkNameStatus = useCallback(
    async (nameStr: string) => {
      const status = await serviceNameResolver.checkIsValidName(nameStr);
      setResolverState((prev) => ({
        ...prev,
        isValidName: status,
        activeAddress: '',
      }));
      return status;
    },
    [serviceNameResolver, setResolverState],
  );

  const fetchNameResolveResult = useCallback(async () => {
    setResolverState((prev) => ({
      ...prev,
      isSearching: true,
      options: [],
      errorMessage: '',
    }));
    try {
      const { success, names, message, length, shownSymbol } =
        await serviceNameResolver.resolveName(name, {
          disableBTC,
          networkId,
        });

      if (success) {
        const defaultValue = names?.[0]?.options?.[0]?.value ?? '';
        const shownAddress = defaultValue.split('-')[1];
        setResolverState((prev) => ({
          ...prev,
          length,
          options: names!,
          activeAddress: shownAddress ?? '',
          shownSymbol,
        }));
      } else {
        setResolverState((prev) => ({
          ...prev,
          options: [],
          shownSymbol,
          activeAddress: '',
          errorMessage: message,
        }));
      }
    } catch (e) {
      // ignore
    } finally {
      setResolverState((prev) => ({
        ...prev,
        isSearching: false,
      }));
    }
  }, [serviceNameResolver, name, setResolverState, disableBTC, networkId]);

  useEffect(() => {
    checkNameStatus(name);
  }, [name, checkNameStatus]);

  useEffect(() => {
    if (!resolverState.isValidName) return;
    fetchNameResolveResult();
  }, [fetchNameResolveResult, resolverState.isValidName, name]);

  if (!resolverState?.isValidName) return null;
  if (resolverState?.errorMessage) {
    return (
      <Typography.Body1 color="action-critical-default">
        {intl.formatMessage(
          {
            id: resolverState?.errorMessage as LocaleIds,
          },
          { 0: resolverState?.shownSymbol },
        )}
      </Typography.Body1>
    );
  }
  if (resolverState?.options?.length) {
    const options = resolverState.options ?? [];

    const defaultValue = options?.[0]?.options?.[0]?.value ?? '';
    const defaultTitle = options?.[0]?.title;
    const optionCount = resolverState?.length;

    if (Number(optionCount) <= 1) {
      return (
        <>
          <Typography.Body2Strong mr="8px" color="text-subdued">
            {defaultTitle ?? '-'}
          </Typography.Body2Strong>
          <Typography.Body2 wordBreak="break-all" color="text-default" mr="8px">
            {resolverState?.activeAddress ?? '-'}
          </Typography.Body2>
        </>
      );
    }

    return (
      <Select
        defaultValue={defaultValue}
        onChange={(v) => {
          const address = v.split('-')[1];
          setResolverState((prev) => ({
            ...prev,
            activeAddress: address,
          }));
        }}
        title={intl.formatMessage({ id: 'message__choose_address' })}
        renderTrigger={(activeItem) => {
          const optionItem = options.find((option) => {
            const item = option.options.find(
              (subItem) => subItem.value === activeItem.value,
            );
            return !!item;
          });

          const address = activeItem.value.split('-')[1];
          return (
            <Box flexDirection="row" justifyContent="space-between">
              <Box flexDirection="row" flex="1">
                <Typography.Body2Strong mr="8px" color="text-subdued">
                  {optionItem?.title ?? '-'}
                </Typography.Body2Strong>
                <Typography.Body2
                  wordBreak="break-all"
                  color="text-default"
                  mr="8px"
                >
                  {address}
                </Typography.Body2>
                <Icon name="ChevronDownSolid" color="icon-default" size={20} />
              </Box>
            </Box>
          );
        }}
        dropdownPosition="left"
        footer={null}
        options={options}
      />
    );
  }

  return (
    <Box flexDirection="row">
      <Spinner size="sm" />
      <Typography.Body2 ml="12px" color="text-subdued">
        {intl.formatMessage({ id: 'message__fetching_addresses' })}
      </Typography.Body2>
    </Box>
  );
};

export default memo(NameServiceResolver);
