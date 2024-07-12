import type { Ref } from 'react';
import { forwardRef, useMemo } from 'react';

import {
  TextArea as TMTextArea,
  getFontSize,
  getTokenValue,
} from 'tamagui';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useSelectionColor } from '../../hooks';
import { getSharedInputStyles } from '../Input/sharedStyles';

import type { IInputProps } from '../Input';
import type { TextAreaProps } from 'tamagui';

export type ITextAreaProps = Pick<
  IInputProps,
  'disabled' | 'editable' | 'error' | 'size'
> &
  Omit<TextAreaProps, 'size'>;

const useHeight = platformEnv.isNativeIOS
  ? ({
      fontSize,
      numberOfLines,
      py,
    }: {
      fontSize: ITextAreaProps['fontSize'];
      py: ITextAreaProps['py'];
      numberOfLines: ITextAreaProps['numberOfLines'];
    }) =>
      useMemo(() => {
        const size =
          typeof fontSize !== 'number' ? getFontSize(fontSize) : fontSize;
        const pySize = getTokenValue(py, 'size') as number;
        return numberOfLines ? size * numberOfLines + pySize * 2 : undefined;
      }, [fontSize, numberOfLines, py])
  : () => undefined;

const defaultTextAlignVertical = platformEnv.isNative ? 'top' : undefined;
function BaseTextArea(
  {
    disabled,
    editable,
    error,
    size,
    textAlignVertical,
    numberOfLines = 3,
    fontSize = getFontSize('$bodyLg'),
    ...props
  }: ITextAreaProps,
  ref: Ref<any>,
) {
  const sharedStyles = getSharedInputStyles({
    disabled,
    editable,
    error,
    size,
  });
  const py = size === 'large' ? '$3.5' : '$2.5';

  const selectionColor = useSelectionColor();
  const height = useHeight({ fontSize, numberOfLines, py });
  return (
    <TMTextArea
      unstyled
      ref={ref}
      fontSize={fontSize}
      height={height}
      px={sharedStyles.px}
      py={py}
      numberOfLines={numberOfLines}
      bg={sharedStyles.backgroundColor}
      color={sharedStyles.color}
      borderRadius={sharedStyles.borderRadius}
      borderWidth={sharedStyles.borderWidth}
      borderColor={sharedStyles.borderColor}
      placeholderTextColor={sharedStyles.placeholderTextColor}
      disabled={disabled}
      selectionColor={selectionColor}
      cursor={sharedStyles.cursor}
      borderCurve="continuous"
      editable={editable}
      textAlignVertical={textAlignVertical || defaultTextAlignVertical}
      {...props}
    />
  );
}

export const TextArea = forwardRef(BaseTextArea);
