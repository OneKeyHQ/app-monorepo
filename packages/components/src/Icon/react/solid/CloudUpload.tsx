import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

function SvgCloudUpload(props: SvgProps) {
  return (
    <Svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      {...props}
    >
      <Path d="M5.5 13a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.977A4.5 4.5 0 1113.5 13H11V9.413l1.293 1.293a1 1 0 001.414-1.414l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13H5.5z" />
      <Path d="M9 13h2v5a1 1 0 11-2 0v-5z" />
    </Svg>
  );
}

export default SvgCloudUpload;
