import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

function SvgCloud(props: SvgProps) {
  return (
    <Svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      {...props}
    >
      <Path d="M5.5 16a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.977A4.5 4.5 0 1113.5 16h-8z" />
    </Svg>
  );
}

export default SvgCloud;
