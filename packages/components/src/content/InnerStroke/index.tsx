import { memo } from 'react';

import { StyleSheet } from 'react-native';

import { Stack } from '../../primitives';

import type { IStackProps } from '../../primitives';

/**
 * Hairline inner stroke overlay for rounded elements.
 *
 * RN/CSS box-shadow inset paints under children, and outline-offset
 * is clipped by overflow:hidden. A sibling layer rendered after the
 * content is the only cross-platform way to draw a stroke above
 * 100%-fill content inside a rounded clip.
 *
 * Place inside a parent with matching borderRadius + overflow:hidden.
 */
function BasicInnerStroke({
  borderRadius,
  borderColor = 'rgba(0, 0, 0, 0.1)',
  ...rest
}: Omit<IStackProps, 'borderRadius'> & {
  borderRadius: IStackProps['borderRadius'];
}) {
  return (
    <Stack
      position="absolute"
      top={0}
      left={0}
      right={0}
      bottom={0}
      borderRadius={borderRadius}
      borderCurve="continuous"
      borderWidth={StyleSheet.hairlineWidth}
      borderColor={borderColor}
      pointerEvents="none"
      {...rest}
    />
  );
}

export const InnerStroke = memo(BasicInnerStroke);
