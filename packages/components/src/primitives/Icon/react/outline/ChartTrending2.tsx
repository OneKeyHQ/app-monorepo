import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChartTrending2 = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m19 11-.586-.586a2 2 0 0 0-2.828 0L13.25 12.75c-.69.69-1.81.69-2.5 0v0c-.69-.69-1.81-.69-2.5 0L4 17M4 4v13m16 3H6a2 2 0 0 1-2-2v-1"
    />
  </Svg>
);
export default SvgChartTrending2;
