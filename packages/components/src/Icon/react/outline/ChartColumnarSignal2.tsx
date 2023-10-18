import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChartColumnarSignal2 = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 17v2m6-6v6m6-10v10m6-14v14"
    />
  </Svg>
);
export default SvgChartColumnarSignal2;
