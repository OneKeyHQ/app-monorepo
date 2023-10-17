import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgStopwatch = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m12 13-3-3m1-8h4m6 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z"
    />
  </Svg>
);
export default SvgStopwatch;
