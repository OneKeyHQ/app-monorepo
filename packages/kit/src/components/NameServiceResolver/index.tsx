/* eslint-disable no-nested-ternary */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { FC } from 'react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Icon,
  Select,
  Spinner,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import type { LocaleIds } from '@onekeyhq/components/src/locale';
import type { SelectGroupItem } from '@onekeyhq/components/src/Select';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useDebounce } from '@onekeyhq/kit/src/hooks';

import type { IBoxProps } from 'native-base';

type NameServiceState = {
  isSearching: boolean;
  isValidName: boolean;
  options: SelectGroupItem<string>[];
  errorMessage?: string;
  length?: number;
  activeAddress: string;
  shownSymbol?: string;
  name: string;
};

type NameServiceResolverProps = {
  disable?: boolean;
  name: string;
  disableBTC?: boolean;
  networkId?: string;
  onChange?: (state: NameServiceState) => void;
};

const Wrapper: FC<IBoxProps> = ({ children, ...rest }) => (
  <Box
    flexDirection="row"
    alignSelf="stretch"
    px="12px"
    py="8px"
    rounded="12px"
    bgColor="action-secondary-default"
    borderWidth={1}
    borderColor="border-default"
    {...rest}
  >
    {children}
  </Box>
);

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
      name: state?.name,
      isValid: state?.isValidName,
    }),
    [state?.activeAddress, buildDisableStatus, state?.name, state?.isValidName],
  );
};

const NameServiceResolver: FC<NameServiceResolverProps> = ({
  name: nameInput,
  onChange,
  disableBTC,
  networkId,
  disable = false,
}) => {
  const name = useDebounce(nameInput, 500);
  const isVerticalLayout = useIsVerticalLayout();
  const intl = useIntl();
  const { serviceNameResolver } = backgroundApiProxy;
  const [resolverState, handleResolverState] = useState<NameServiceState>({
    isSearching: false,
    isValidName: false,
    length: 0,
    options: [],
    activeAddress: '',
    shownSymbol: '',
    name: '',
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
      const status = await serviceNameResolver.checkIsValidName(
        nameStr,
        networkId,
      );
      setResolverState((prev) => ({
        ...prev,
        isValidName: status,
        activeAddress: '',
        name: '',
      }));
      return status;
    },
    [networkId, serviceNameResolver, setResolverState],
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
          name: name?.split('.')?.slice(0, -1)?.join('.') ?? '',
        }));
      } else {
        setResolverState((prev) => ({
          ...prev,
          options: [],
          shownSymbol,
          activeAddress: '',
          name: '',
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
    if (disable) return;
    checkNameStatus(name);
  }, [name, checkNameStatus, disable]);

  useEffect(() => {
    if (disable) return;
    if (!resolverState.isValidName) return;
    fetchNameResolveResult();
  }, [fetchNameResolveResult, resolverState.isValidName, name, disable]);

  if (disable) return null;
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
        <Wrapper>
          <Typography.Body2Strong mr="12px" color="text-subdued">
            {defaultTitle ?? '-'}
          </Typography.Body2Strong>
          <Typography.Body2 flex={1} wordBreak="break-all" color="text-default">
            {resolverState?.activeAddress ?? '-'}
          </Typography.Body2>
        </Wrapper>
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
        headerShown={!!isVerticalLayout}
        renderTrigger={({ activeOption, isHovered, isPressed, visible }) => {
          const optionItem = options.find((option) => {
            const item = option.options.find(
              (subItem) => subItem.value === activeOption.value,
            );
            return !!item;
          });

          const address = activeOption.value.split('-')[1];
          return (
            <Wrapper
              bgColor={
                isHovered
                  ? 'action-secondary-hovered'
                  : isPressed
                  ? 'action-secondary-pressed'
                  : visible
                  ? 'surface-selected'
                  : 'action-secondary-default'
              }
            >
              <Typography.Body2Strong mr="12px" color="text-subdued">
                {optionItem?.title ?? '-'}
              </Typography.Body2Strong>
              <Typography.Body2
                flex={1}
                wordBreak="break-all"
                color="text-default"
              >
                {address}
              </Typography.Body2>
              <Box ml="12px">
                <Icon name="ChevronDownMini" color="icon-subdued" size={20} />
              </Box>
            </Wrapper>
          );
        }}
        dropdownPosition="left"
        dropdownProps={{
          height: isVerticalLayout ? '70%' : '240px',
        }}
        footer={null}
        options={options}
      />
    );
  }

  return (
    <Box py="8px" flexDirection="row">
      <Spinner size="sm" />
      <Typography.Body2 ml="12px" color="text-subdued">
        {intl.formatMessage({ id: 'message__fetching_addresses' })}
      </Typography.Body2>
    </Box>
  );
};

export default memo(NameServiceResolver);
