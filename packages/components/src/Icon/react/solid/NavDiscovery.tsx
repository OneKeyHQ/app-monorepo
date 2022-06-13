import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

function SvgNavDiscovery(props: SvgProps) {
  return (
    <Svg
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M2 12C2 6.48 6.47 2 12 2c5.52 0 10 4.48 10 10 0 5.53-4.48 10-10 10-5.53 0-10-4.47-10-10zm12.23 1.83l1.62-5.12a.45.45 0 00-.56-.57l-5.12 1.6c-.21.07-.38.23-.44.44l-1.6 5.13c-.11.34.22.67.56.56l5.1-1.6c.21-.06.38-.23.44-.44z"
      />
    </Svg>
  );
}

export default SvgNavDiscovery;
