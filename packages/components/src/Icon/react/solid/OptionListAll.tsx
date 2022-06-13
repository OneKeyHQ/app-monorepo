import * as React from 'react';
import Svg, { SvgProps, Rect, Path } from 'react-native-svg';

function SvgOptionListAll(props: SvgProps) {
  return (
    <Svg
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <Rect width={24} height={24} rx={12} />
      <Path
        d="M11 9a2 2 0 11-4 0 2 2 0 014 0zM17 9a2 2 0 11-4 0 2 2 0 014 0zM17 15a2 2 0 11-4 0 2 2 0 014 0zM11 15a2 2 0 11-4 0 2 2 0 014 0z"
        fill="#8C8CA1"
      />
    </Svg>
  );
}

export default SvgOptionListAll;
