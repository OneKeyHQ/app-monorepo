import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

const SvgCube = (props: SvgProps) => (
  <Svg viewBox="0 0 20 20" fill="currentColor" {...props}>
    <Path d="M11 17a1 1 0 0 0 1.447.894l4-2A1 1 0 0 0 17 15V9.236a1 1 0 0 0-1.447-.894l-4 2a1 1 0 0 0-.553.894V17zm4.211-10.724a1 1 0 0 0 0-1.788l-4.764-2.382a1 1 0 0 0-.894 0L4.789 4.488a1 1 0 0 0 0 1.788l4.764 2.382a1 1 0 0 0 .894 0l4.764-2.382zM4.447 8.342A1 1 0 0 0 3 9.236V15a1 1 0 0 0 .553.894l4 2A1 1 0 0 0 9 17v-5.764a1 1 0 0 0-.553-.894l-4-2z" />
  </Svg>
);

export default SvgCube;
