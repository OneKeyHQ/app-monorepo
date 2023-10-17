import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChartWhiteboard = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M16 18h3a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-7m4 13 1 3m-1-3H8m0 0H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h7M8 18l-1 3m5-3v2m0-15V3"
    />
  </Svg>
);
export default SvgChartWhiteboard;
