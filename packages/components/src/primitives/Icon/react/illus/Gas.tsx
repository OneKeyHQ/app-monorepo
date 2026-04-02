import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgGas = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 16 16" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M2 12.667v-10A.667.667 0 0 1 2.667 2h6a.667.667 0 0 1 .667.667V8h1.333A1.333 1.333 0 0 1 12 9.333V12a.667.667 0 1 0 1.334 0V7.333H12a.667.667 0 0 1-.666-.666V4.276l-1.105-1.105.943-.942 3.3 3.3a.66.66 0 0 1 .195.471v6a2 2 0 0 1-4 0V9.333H9.334v3.334H10V14H1.334v-1.333zm1.334-9.334v4H8v-4z"
    />
  </Svg>
);
export default SvgGas;
