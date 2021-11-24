import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

function SvgBookmark(props: SvgProps) {
  return (
    <Svg viewBox="0 0 20 20" fill="currentColor" {...props}>
      <Path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
    </Svg>
  );
}

export default SvgBookmark;
