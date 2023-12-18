import { useCallback } from 'react';

import { useMedia } from 'tamagui';

import { SearchBar } from '../../SearchBar';

import type {
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
  autoFocus,
  isModalScreen,
  onBlur,
  onFocus,
  onChangeText,
  onSearchButtonPress,
  placeholder,
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
      containerProps={{
        alignSelf: 'stretch',
        mb: '$4',
        mx: '$5',
        $gtMd: {
          ...(!isModalScreen && {
            width: '$52',
            alignSelf: 'auto',
            mb: '$0',
          }),
        },
      }}
      {...(media.gtMd &&
        !isModalScreen && {
          size: 'small',
        })}
      autoFocus={autoFocus}
      onBlur={onBlurCallback}
      onFocus={onFocusCallback}
      onChangeText={handleChangeCallback}
      onSubmitEditing={onSubmitEditingCallback}
      placeholder={placeholder}
    />
  );
}

export default HeaderSearchBar;
