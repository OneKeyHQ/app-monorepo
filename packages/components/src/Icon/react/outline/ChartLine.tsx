import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChartLine = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 5v14m-5.996-8L3 19M21 8v11m-6.002-5v5"
    />
  </Svg>
);
export default SvgChartLine;
