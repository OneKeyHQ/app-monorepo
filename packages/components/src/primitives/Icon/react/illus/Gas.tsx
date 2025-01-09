import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgGas = (props: SvgProps) => (
  <Svg viewBox="0 0 16 16" fill="none" accessibilityRole="image" {...props}>
    <Path
      d="M2 12.667v-10A.667.667 0 0 1 2.667 2h6a.667.667 0 0 1 .667.667V8h1.333A1.333 1.333 0 0 1 12 9.333V12a.667.667 0 1 0 1.334 0V7.333H12a.667.667 0 0 1-.666-.666V4.276l-1.105-1.105.943-.942 3.3 3.3a.664.664 0 0 1 .195.471v6a2 2 0 0 1-4 0V9.333H9.334v3.334H10V14H1.334v-1.333H2Zm1.333-9.334v4H8v-4H3.333Z"
      fill="currentColor"
    />
  </Svg>
);
export default SvgGas;
