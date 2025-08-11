import type { CompositionEvent } from 'react';
import { useCallback, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { Input } from '../../forms/Input';

import type { IInputProps } from '../../forms/Input';

export type ISearchBarProps = IInputProps & {
  onSearchTextChange?: (text: string) => void;
};

const NATIVE_COMPOSITION_SPACE = String.fromCharCode(8198);

export function SearchBar({
  value: controlledValue,
  onChangeText,
  onSearchTextChange,
  testID,
  containerProps,
  ...rest
}: ISearchBarProps) {
  const [internalValue, setInternalValue] = useState('');
  const compositionLockRef = useRef(false);
  const searchTextRef = useRef('');

  // Use controlled value if provided, otherwise use internal state
  const value = controlledValue !== undefined ? controlledValue : internalValue;

  const handleChange = useCallback(
    (text: string) => {
      // Only update internal state if not controlled
      if (controlledValue === undefined) {
        setInternalValue(text);
      }
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
    [controlledValue, onChangeText, onSearchTextChange],
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
  const intl = useIntl();
  return (
    <Input
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
