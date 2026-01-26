import type { CompositionEvent } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';
import { useDebouncedCallback } from 'use-debounce';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { Input } from '../../forms/Input';

import type { IInputProps, IInputRef } from '../../forms/Input';

export type ISearchBarProps = IInputProps & {
  onSearchTextChange?: (text: string) => void;
  debounceInterval?: number; // debounce works only if value is undefined
};

const NATIVE_COMPOSITION_SPACE = String.fromCharCode(8198);
const DEFAULT_DELAY_MS = 350;

export function SearchBar({
  value: controlledValue,
  onChangeText,
  onSearchTextChange,
  testID,
  containerProps,
  debounceInterval = 300, // debounce works only if value is undefined
  autoFocus,
  selectTextOnFocus,
  ...rest
}: ISearchBarProps) {
  const [internalValue, setInternalValue] = useState('');
  const compositionLockRef = useRef(false);
  const searchTextRef = useRef('');
  const inputRef = useRef<IInputRef | null>(null);

  const resolvedAutoFocusDelayMs = autoFocus ? DEFAULT_DELAY_MS : undefined;
  const shouldDelayAutoFocus =
    !!autoFocus && (resolvedAutoFocusDelayMs ?? 0) > 0;

  useEffect(() => {
    if (!shouldDelayAutoFocus || !resolvedAutoFocusDelayMs) {
      return;
    }
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, resolvedAutoFocusDelayMs);
    return () => clearTimeout(timer);
  }, [resolvedAutoFocusDelayMs, shouldDelayAutoFocus]);

  const resolvedAutoFocus = shouldDelayAutoFocus ? false : autoFocus;

  // Use controlled value if provided, otherwise use internal state
  const value = controlledValue !== undefined ? controlledValue : internalValue;

  const onChangeTextCallback = useCallback(
    (text: string) => {
      onChangeText?.(text);
      if (platformEnv.isNative) {
        onSearchTextChange?.(text.replaceAll(NATIVE_COMPOSITION_SPACE, ''));
      } else {
        if (compositionLockRef.current) {
          if (controlledValue !== undefined && !onChangeText) {
            onSearchTextChange?.(text);
          }
          return;
        }
        searchTextRef.current = text;
        onSearchTextChange?.(text);
      }
    },
    [onChangeText, onSearchTextChange, controlledValue],
  );
  const onChangeTextDebounced = useDebouncedCallback(
    onChangeTextCallback,
    debounceInterval,
    {
      leading: false,
      trailing: true,
    },
  );

  const handleChange = useCallback(
    (text: string) => {
      // Only update internal state if not controlled
      if (controlledValue === undefined) {
        setInternalValue(text);
        if (!text) {
          onChangeTextDebounced('');
        } else {
          onChangeTextDebounced(text);
        }
      } else {
        onChangeTextCallback(text);
      }
    },
    [controlledValue, onChangeTextCallback, onChangeTextDebounced],
  );

  const handleClearValue = useCallback(() => {
    handleChange('');
  }, [handleChange]);

  const handleCompositionStart = useCallback(() => {
    compositionLockRef.current = true;
  }, []);

  const handleCompositionEnd = useCallback(
    (e: CompositionEvent) => {
      compositionLockRef.current = false;
      const target = e.target as HTMLInputElement;
      const finalValue = target?.value || '';
      searchTextRef.current = finalValue;
      onSearchTextChange?.(finalValue);
    },
    [onSearchTextChange],
  );
  const intl = useIntl();
  return (
    <Input
      ref={inputRef}
      autoFocus={resolvedAutoFocus}
      selectTextOnFocus={selectTextOnFocus}
      value={value}
      onChangeText={handleChange}
      leftIconName="SearchOutline"
      returnKeyType="search"
      returnKeyLabel="Search"
      testID={testID ? `nav-header-search-${testID}` : 'nav-header-search'}
      placeholder={intl.formatMessage({
        id: ETranslations.global_search,
      })}
      {...rest}
      {...(value?.length &&
        !rest.addOns?.length && {
          addOns: [
            {
              iconName: 'XCircleOutline',
              onPress: handleClearValue,
              testID: `${testID || ''}-clear`,
            },
          ],
        })}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
      containerProps={{
        w: '100%',
        borderRadius: '$full',
        bg: '$bgStrong',
        borderColor: '$transparent',
        overflow: 'hidden',
        ...containerProps,
      }}
    />
  );
}
