import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChartTrendingUp = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M16 7h5v5m-.5-4.5-6.086 6.086a2 2 0 0 1-2.828 0l-1.172-1.172a2 2 0 0 0-2.828 0L3 17"
    />
  </Svg>
);
export default SvgChartTrendingUp;
