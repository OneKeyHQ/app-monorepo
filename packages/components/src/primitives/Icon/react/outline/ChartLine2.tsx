import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChartLine2 = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 11v5m5-11v11m5-3v3M4 4v14a2 2 0 0 0 2 2h15"
    />
  </Svg>
);
export default SvgChartLine2;
