import { useCallback, useMemo } from 'react';

import { useMedia } from '@onekeyhq/components/src/hooks/useStyle';

import { XStack } from '../../../primitives';
import { SearchBar } from '../../SearchBar';

import type { IInputAddOnProps } from '../../../forms/Input/InputAddOnItem';
import type {
  BlurEvent,
  FocusEvent,
  NativeSyntheticEvent,
  TargetedEvent,
  TextInputFocusEventData,
  TextInputSubmitEditingEventData,
} from 'react-native';

type IHeaderSearchBarProps = {
  height?: string;
  autoFocus?: boolean;
  isModalScreen?: boolean;
  /**
   * A callback that gets called when search bar has lost focus
   */
  onBlur?: (e: NativeSyntheticEvent<TargetedEvent>) => void;

  onSearchTextChange?: (text: string) => void;
  /**
   * A callback that gets called when the text changes. It receives the current text value of the search bar.
   */
  onChangeText?: (e: NativeSyntheticEvent<TextInputFocusEventData>) => void;
  /**
   * A callback that gets called when search bar has received focus
   */
  onFocus?: (e: NativeSyntheticEvent<TargetedEvent>) => void;
  /**
   * A callback that gets called when the search button is pressed. It receives the current text value of the search bar.
   */
  onSearchButtonPress?: (
    e: NativeSyntheticEvent<TextInputFocusEventData>,
  ) => void;
  /**
   * Text displayed when search field is empty
   */
  placeholder?: string;
  /**
   * Test ID for e2e testing purposes.For different search bars.
   */
  testID?: string;

  addOns?: IInputAddOnProps[];
  searchBarInputValue?: string;
};

function HeaderSearchBar({
  autoFocus,
  isModalScreen,
  onBlur,
  onFocus,
  onSearchTextChange,
  onChangeText,
  onSearchButtonPress,
  placeholder,
  addOns,
  searchBarInputValue,
}: IHeaderSearchBarProps) {
  const media = useMedia();

  const handleChangeCallback = useCallback(
    (value: string) => {
      onChangeText?.({
        nativeEvent: {
          text: value,
        },
      } as NativeSyntheticEvent<TextInputFocusEventData>);
    },
    [onChangeText],
  );

  const onBlurCallback = useCallback(
    (e: BlurEvent) => {
      onBlur?.(e);
    },
    [onBlur],
  );

  const onFocusCallback = useCallback(
    (e: FocusEvent) => {
      onFocus?.(e); // Stub event object
    },
    [onFocus],
  );

  const onSubmitEditingCallback = useCallback(
    (e: NativeSyntheticEvent<TextInputSubmitEditingEventData>) => {
      onSearchButtonPress?.(e as NativeSyntheticEvent<TextInputFocusEventData>);
    },
    [onSearchButtonPress],
  );

  const searchBarContainerProps = useMemo(
    () => ({
      alignSelf: 'stretch' as const,
      mb: '$4' as const,
      $gtMd: {
        ...(!isModalScreen && {
          width: '$52' as const,
          alignSelf: 'auto' as const,
          mb: '$0' as const,
        }),
      },
    }),
    [isModalScreen],
  );

  return (
    <XStack px="$5" w="100%">
      <SearchBar
        containerProps={searchBarContainerProps}
        {...(media.gtMd &&
          !isModalScreen && {
            size: 'small',
          })}
        autoFocus={autoFocus}
        onBlur={onBlurCallback}
        onFocus={onFocusCallback}
        onSearchTextChange={onSearchTextChange}
        onChangeText={handleChangeCallback}
        onSubmitEditing={onSubmitEditingCallback}
        placeholder={placeholder}
        addOns={addOns}
        value={searchBarInputValue}
      />
    </XStack>
  );
}

export default HeaderSearchBar;
