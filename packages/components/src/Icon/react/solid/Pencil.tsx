import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

const SvgPencil = (props: SvgProps) => (
  <Svg viewBox="0 0 20 20" fill="currentColor" {...props}>
    <Path d="M13.586 3.586a2 2 0 1 1 2.828 2.828l-.793.793-2.828-2.828.793-.793zm-2.207 2.207L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
  </Svg>
);

export default SvgPencil;
