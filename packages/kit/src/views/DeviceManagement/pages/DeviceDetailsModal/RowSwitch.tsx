import type { ComponentProps } from 'react';

import { PixelRatio } from 'react-native';

import { Stack, Switch } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

// iOS draws the switch high against the row's text, whose lowercase sits
// below the line's centre; lowered to line up by eye.
const IOS_OFFSET_Y = 1.5;

// A settings row's switch.
export function RowSwitch(props: ComponentProps<typeof Switch>) {
  // testID flows through {...props}.
  // oxlint-disable-next-line onekey/require-testid
  const control = <Switch size="small" {...props} />;
  if (!platformEnv.isNativeIOS) return control;
  // On whole pixels, so the switch stays crisp.
  return (
    <Stack y={PixelRatio.roundToNearestPixel(IOS_OFFSET_Y)}>{control}</Stack>
  );
}
