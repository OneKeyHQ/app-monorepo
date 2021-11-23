import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

function SvgUserRemove(props: SvgProps) {
  return (
    <Svg fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}>
      <Path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 7a4 4 0 11-8 0 4 4 0 018 0zm-4 7a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zm12-2h-6"
      />
    </Svg>
  );
}

export default SvgUserRemove;
