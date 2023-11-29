import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChartPieDashboard = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M21.717 14.374c.185-.761.283-1.556.283-2.374 0-5.185-3.947-9.449-9-9.95v9.243l8.717 3.08Z"
    />
    <Path
      fill="currentColor"
      d="m21.05 16.26-9.383-3.317A1 1 0 0 1 11 12V2.05c-5.053.5-9 4.764-9 9.95 0 5.523 4.477 10 10 10 4 0 7.45-2.348 9.05-5.74Z"
    />
  </Svg>
);
export default SvgChartPieDashboard;
