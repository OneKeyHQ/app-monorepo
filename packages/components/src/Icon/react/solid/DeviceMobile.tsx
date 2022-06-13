import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

function SvgDeviceMobile(props: SvgProps) {
  return (
    <Svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      {...props}
    >
      <Path
        fillRule="evenodd"
        d="M7 2a2 2 0 00-2 2v12a2 2 0 002 2h6a2 2 0 002-2V4a2 2 0 00-2-2H7zm3 14a1 1 0 100-2 1 1 0 000 2z"
        clipRule="evenodd"
      />
    </Svg>
  );
}

export default SvgDeviceMobile;
