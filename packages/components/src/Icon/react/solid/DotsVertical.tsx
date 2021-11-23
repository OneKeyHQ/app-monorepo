import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

function SvgDotsVertical(props: SvgProps) {
  return (
    <Svg viewBox="0 0 20 20" fill="currentColor" {...props}>
      <Path d="M10 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4z" />
    </Svg>
  );
}

export default SvgDotsVertical;
