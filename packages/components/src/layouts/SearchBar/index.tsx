import type { CompositionEvent } from 'react';
import { useCallback, useRef, useState } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { Input } from '../../forms/Input';

import type { IInputProps } from '../../forms/Input';

export type ISearchBarProps = IInputProps & {
  onSearchTextChange?: (text: string) => void;
};

const NATIVE_COMPOSITION_SPACE = String.fromCharCode(8198);

export function SearchBar({
  value: defaultValue,
  onChangeText,
  onSearchTextChange,
  ...rest
}: ISearchBarProps) {
  const [value, setValue] = useState(defaultValue ?? '');
  const compositionLockRef = useRef(false);
  const searchTextRef = useRef('');

  const handleChange = useCallback(
    (text: string) => {
      setValue(text);
      onChangeText?.(text);
      // This is a simple solution to support pinyin composition on iOS.
      if (platformEnv.isNative) {
        onSearchTextChange?.(text.replaceAll(NATIVE_COMPOSITION_SPACE, ''));
      } else {
        // on Web
        if (compositionLockRef.current) {
          if (!searchTextRef.current) {
            onSearchTextChange?.(text.replaceAll(' ', ''));
          } else {
            onSearchTextChange?.(
              `${searchTextRef.current}${
                text
                  ?.slice(searchTextRef.current.length)
                  ?.replaceAll(' ', '') || ''
              }`,
            );
          }
          return;
        }
        searchTextRef.current = text;
        onSearchTextChange?.(text);
      }
    },
    [onChangeText, onSearchTextChange],
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
      handleChange(`${searchTextRef.current}${e.data || ''}`);
    },
    [handleChange],
  );
  return (
    <Input
      value={value}
      onChangeText={handleChange}
      leftIconName="SearchOutline"
      {...(value?.length && {
        addOns: [
          {
            iconName: 'XCircleOutline',
            onPress: handleClearValue,
            testID: `${rest.testID || ''}-clear`,
          },
        ],
      })}
      returnKeyType="search"
      returnKeyLabel="Search"
      testID="nav-header-search"
      {...rest}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
    />
  );
}
