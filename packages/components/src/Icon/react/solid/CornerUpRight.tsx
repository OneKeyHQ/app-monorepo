import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCornerUpRight = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M6.793 13.707a1 1 0 0 0 1.414-1.414L5.914 10H16a3 3 0 0 1 3 3v6a1 1 0 1 0 2 0v-6a5 5 0 0 0-5-5H5.914l2.293-2.293a1 1 0 0 0-1.414-1.414L3.5 7.586a2 2 0 0 0 0 2.828l3.293 3.293Z"
    />
  </Svg>
);
export default SvgCornerUpRight;
