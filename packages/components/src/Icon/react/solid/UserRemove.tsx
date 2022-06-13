import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

function SvgUserRemove(props: SvgProps) {
  return (
    <Svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      {...props}
    >
      <Path d="M11 6a3 3 0 11-6 0 3 3 0 016 0zm3 11a6 6 0 00-12 0h12zm-1-9a1 1 0 100 2h4a1 1 0 100-2h-4z" />
    </Svg>
  );
}

export default SvgUserRemove;
