import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgRainbow = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={2}
      d="M1.043 17C1.548 11.393 6.26 7 11.998 7s10.45 4.393 10.955 10M5.07 17a7.002 7.002 0 0 1 13.858 0M9.17 17a3.001 3.001 0 0 1 5.658 0"
    />
  </Svg>
);
export default SvgRainbow;
