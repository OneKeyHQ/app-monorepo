import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgPerformance = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M12 2a1 1 0 0 0-1 1v2a1 1 0 1 0 2 0v-.938A8.001 8.001 0 0 1 12 20 8 8 0 0 1 4.455 9.333a1 1 0 0 0-1.886-.666A9.985 9.985 0 0 0 2 12c0 5.523 4.477 10 10 10s10-4.477 10-10S17.523 2 12 2Z"
    />
    <Path
      fill="currentColor"
      d="M5.043 5.043a1 1 0 0 1 1.414 0l3.878 3.878a3.5 3.5 0 1 1-1.414 1.414L5.043 6.457a1 1 0 0 1 0-1.414Z"
    />
  </Svg>
);
export default SvgPerformance;
