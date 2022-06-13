import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

function SvgOffline(props: SvgProps) {
  return (
    <Svg
      viewBox="0 0 20 20"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M5.024 8.438c.021.198.057.393.107.581A3.5 3.5 0 005.5 16h7.086l-4.204-4.204a1.004 1.004 0 01-.168-.167l-3.19-3.191zM15.115 15.7a4.502 4.502 0 00-2.23-8.66 4.002 4.002 0 00-7.393-.964l4.206 4.207a.895.895 0 01.018.018l5.291 5.291.109.108z"
      />
      <Path d="M3.707 2.293a1 1 0 00-1.414 1.414l6.921 6.922c.05.062.105.118.168.167l6.91 6.911a1 1 0 001.415-1.414l-6.99-6.99a.922.922 0 00-.02-.02l-6.99-6.99z" />
    </Svg>
  );
}

export default SvgOffline;
