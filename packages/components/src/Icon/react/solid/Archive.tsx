import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

function SvgArchive(props: SvgProps) {
  return (
    <Svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      {...props}
    >
      <Path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z" />
      <Path
        fillRule="evenodd"
        d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"
        clipRule="evenodd"
      />
    </Svg>
  );
}

export default SvgArchive;
