import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

function SvgRestore(props: SvgProps) {
  return (
    <Svg viewBox="0 0 20 20" fill="currentColor" {...props}>
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9.988 16a6.047 6.047 0 01-3.99-1.486 5.991 5.991 0 01-2.007-3.735 1 1 0 10-1.982.261 7.991 7.991 0 002.676 4.983 8.047 8.047 0 0010.607-.032 7.977 7.977 0 001.316-10.492 8.03 8.03 0 00-4.639-3.247A8.057 8.057 0 004 4.65V3.035a1 1 0 10-2 0V7a1 1 0 001 1h4.394a1 1 0 100-2H5.476a6.057 6.057 0 015.997-1.81 6.03 6.03 0 013.484 2.437 5.977 5.977 0 01-.988 7.864A6.047 6.047 0 019.989 16z"
      />
    </Svg>
  );
}

export default SvgRestore;
