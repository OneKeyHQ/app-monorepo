import type { ComponentProps } from 'react';
import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Select,
  SizableText,
  Spinner,
  Stack,
  XStack,
} from '@onekeyhq/components';
import type { ISelectSection } from '@onekeyhq/components';
import { checkIsDomain } from '@onekeyhq/shared/src/utils/uriUtils';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../hooks/usePromiseResult';

type IProps = {
  networkId: string;
  nameToResolve: string;
  onChange?: (state: INameResolverState) => void;
  containerProps?: ComponentProps<typeof Stack>;
  selectProps?: ComponentProps<typeof Select>;
};

type INameResolverState = {
  isSearching: boolean;
  isValidName: boolean;
  length: number;
  options: ISelectSection[];
  activeAddress: string;
  showSymbol: string;
  name: string;
  errorMessage: string;
};

const resolverDefaultState: INameResolverState = {
  isSearching: false,
  isValidName: false,
  length: 0,
  options: [],
  activeAddress: '',
  showSymbol: '',
  name: '',
  errorMessage: '',
};

const useNameResolverState = () => {
  const [state, setState] = useState<INameResolverState>(resolverDefaultState);

  return useMemo(
    () => ({
      onChange: setState,
      address: state?.activeAddress,
      name: state?.name,
      isSearching: state?.isSearching,
      isValid: state?.isValidName,
      reset: () => setState(resolverDefaultState),
    }),
    [state?.activeAddress, state?.name, state?.isSearching, state?.isValidName],
  );
};

function NameResolver(props: IProps) {
  const { nameToResolve, networkId, containerProps, selectProps, onChange } =
    props;

  const intl = useIntl();
  const [resolverState, setResolverState] =
    useState<INameResolverState>(resolverDefaultState);

  const handleOnResolverStateChange = useCallback(
    (cb: (v: INameResolverState) => INameResolverState) => {
      setResolverState((prev) => {
        const newState = cb(prev);
        onChange?.(newState);
        return newState;
      });
    },
    [onChange, setResolverState],
  );

  usePromiseResult(async () => {
    try {
      if (!checkIsDomain(nameToResolve)) {
        handleOnResolverStateChange((prev) => ({
          ...prev,
          ...resolverDefaultState,
        }));
        return;
      }

      handleOnResolverStateChange((prev) => ({ ...prev, isSearching: true }));
      const r = await backgroundApiProxy.serviceNameResolver.resolveName({
        name: nameToResolve,
        networkId,
      });

      const { names, length, showSymbol } = r;
      const defaultValue = names?.[0]?.data?.[0]?.value ?? '';
      const shownAddress = defaultValue;
      handleOnResolverStateChange((prev) => ({
        ...prev,
        isSearching: false,
        isValidName: true,
        length,
        options: names,
        activeAddress: shownAddress,
        showSymbol,
        name: nameToResolve,
      }));
    } catch (e: any) {
      handleOnResolverStateChange((prev) => ({
        ...prev,
        isValidName: false,
        isSearching: false,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        errorMessage: e.message,
      }));
    }
  }, [handleOnResolverStateChange, nameToResolve, networkId]);

  const renderNameResolver = useCallback(() => {
    if (resolverState.isSearching) {
      return (
        <XStack alignItems="center" space="$4">
          <Spinner />
          <SizableText>
            {intl.formatMessage({ id: 'message__fetching_addresses' })}
          </SizableText>
        </XStack>
      );
    }

    if (!resolverState.isValidName) {
      return (
        <SizableText color="$textCritical">
          {resolverState.errorMessage}
        </SizableText>
      );
    }
    return (
      <Select
        value={resolverState.activeAddress}
        onChange={(v) => {
          handleOnResolverStateChange((prev) => ({
            ...prev,
            activeAddress: v as string,
          }));
        }}
        title={intl.formatMessage({ id: 'message__choose_address' })}
        sections={resolverState.options}
        {...selectProps}
      />
    );
  }, [
    handleOnResolverStateChange,
    intl,
    resolverState.activeAddress,
    resolverState.errorMessage,
    resolverState.isSearching,
    resolverState.isValidName,
    resolverState.options,
    selectProps,
  ]);
  return <Stack {...containerProps}>{renderNameResolver()}</Stack>;
}
export { NameResolver, useNameResolverState };
export type { INameResolverState };
