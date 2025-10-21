import {
  getButtonSized,
  getFontSized,
  getSpace,
  getVariableValue,
} from '@onekeyhq/components/src/shared/tamagui';
import type { SizeVariantSpreadFunction } from '@onekeyhq/components/src/shared/tamagui';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

const isWeb = !platformEnv.isNative;

export const textAreaSizeVariant: SizeVariantSpreadFunction<any> = (
  val = '$true',
  extras,
) => {
  const { props } = extras;
  const buttonStyles = getButtonSized(val, extras);
  const fontStyle = getFontSized(val as any, extras)!;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const lines = props.rows ?? props.numberOfLines;
  const height =
    typeof lines === 'number'
      ? lines * getVariableValue(fontStyle.lineHeight)
      : 'auto';
  const paddingVertical = getSpace(val, {
    shift: -2,
    bounds: [2],
  });
  const paddingHorizontal = getSpace(val, {
    shift: -1,
    bounds: [2],
  });
  return {
    ...buttonStyles,
    ...fontStyle,
    paddingVertical,
    paddingHorizontal,
    height,
  };
};

export const inputSizeVariant: SizeVariantSpreadFunction<any> = (
  val = '$true',
  extras,
) => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  if (extras.props.multiline || extras.props.numberOfLines > 1) {
    return textAreaSizeVariant(val, extras);
  }
  const buttonStyles = getButtonSized(val, extras);
  const paddingHorizontal = getSpace(val, {
    shift: -1,
    bounds: [2],
  });
  const fontStyle = getFontSized(val as any, extras);
  // lineHeight messes up input on native
  if (!isWeb && fontStyle) {
    delete fontStyle.lineHeight;
  }
  return {
    ...fontStyle,
    ...buttonStyles,
    paddingHorizontal,
  };
};
