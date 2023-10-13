import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChartDashbord2 = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 4h16M4 4v11a2 2 0 0 0 2 2h6M4 4h18-2M4 4H2m18 0v11a2 2 0 0 1-2 2h-6m0 0 2 3m-2-3-2 3m2-12v5m-4-1v1m8-3v3"
    />
  </Svg>
);
export default SvgChartDashbord2;
