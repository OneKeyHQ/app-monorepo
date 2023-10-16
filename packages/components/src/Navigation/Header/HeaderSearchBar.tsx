import { useCallback } from 'react';

import { useMedia } from 'tamagui';

import { SearchBar } from '../../SearchBar';

import type {
  NativeSyntheticEvent,
  TargetedEvent,
  TextInputFocusEventData,
  TextInputSubmitEditingEventData,
} from 'react-native';

type HeaderSearchBarProps = {
  height?: string;
  /**
   * A callback that gets called when search bar has lost focus
   */
  onBlur?: (e: NativeSyntheticEvent<TargetedEvent>) => void;
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
};

function HeaderSearchBar({
  onBlur,
  onFocus,
  onChangeText,
  onSearchButtonPress,
  placeholder,
}: HeaderSearchBarProps) {
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
    (e: NativeSyntheticEvent<TextInputFocusEventData>) => {
      onBlur?.(e);
    },
    [onBlur],
  );

  const onFocusCallback = useCallback(
    (e: NativeSyntheticEvent<TextInputFocusEventData>) => {
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

  return (
    <SearchBar
      height={media.gtMd ? '$8' : '$9'}
      onBlur={onBlurCallback}
      onFocus={onFocusCallback}
      onChange={handleChangeCallback}
      onSubmitEditing={onSubmitEditingCallback}
      placeholder={placeholder}
    />
  );
}

export default HeaderSearchBar;
