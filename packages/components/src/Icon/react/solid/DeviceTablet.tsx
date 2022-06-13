import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

function SvgDeviceTablet(props: SvgProps) {
  return (
    <Svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      {...props}
    >
      <Path
        fillRule="evenodd"
        d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4a2 2 0 00-2-2H6zm4 14a1 1 0 100-2 1 1 0 000 2z"
        clipRule="evenodd"
      />
    </Svg>
  );
}

export default SvgDeviceTablet;
