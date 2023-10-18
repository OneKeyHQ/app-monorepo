import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChartDashbord = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 18h4a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4m6 0 1 3.5M15 18H9m0 0-1 3.5M8 13v1m4-6v6m4-3v3"
    />
  </Svg>
);
export default SvgChartDashbord;
