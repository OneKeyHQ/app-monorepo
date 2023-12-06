import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBlock = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M2 12C2 6.477 6.477 2 12 2c2.401 0 4.605.846 6.329 2.257L4.257 18.33A9.958 9.958 0 0 1 2 12Zm3.671 7.743A9.959 9.959 0 0 0 12 22c5.523 0 10-4.477 10-10a9.959 9.959 0 0 0-2.257-6.329L5.67 19.743Z"
    />
  </Svg>
);
export default SvgBlock;
