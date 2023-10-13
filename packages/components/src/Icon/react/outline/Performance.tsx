import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgPerformance = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M10 10 5.75 5.75M12 5V3a9 9 0 1 1-8.488 6M14.5 12a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z"
    />
  </Svg>
);
export default SvgPerformance;
