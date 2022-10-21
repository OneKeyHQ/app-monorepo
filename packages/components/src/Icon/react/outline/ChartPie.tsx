import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChartPie = (props: SvgProps) => (
  <Svg
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M11 3.055A9.001 9.001 0 1 0 20.945 13H11V3.055z"
    />
    <Path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M20.488 9H15V3.512A9.025 9.025 0 0 1 20.488 9z"
    />
  </Svg>
);
export default SvgChartPie;
