import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgApple = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9.032 2.5c1.854.977 2.72 2.405 2.967 4.505m0 0C.133 2 2.606 24.525 12 20.52 21.396 24.525 23.869 2 12 7.005Z"
    />
  </Svg>
);
export default SvgApple;
