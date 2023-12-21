import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChartTrending2 = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M4 3a1 1 0 0 1 1 1v10.586l2.543-2.543a2.768 2.768 0 0 1 3.914 0c.3.3.786.3 1.086 0l2.336-2.336a3 3 0 0 1 4.242 0l.586.586a1 1 0 0 1-1.414 1.414l-.586-.586a1 1 0 0 0-1.414 0l-2.336 2.336a2.768 2.768 0 0 1-3.914 0c-.3-.3-.786-.3-1.086 0L5 17.414V18a1 1 0 0 0 1 1h14a1 1 0 1 1 0 2H6a3 3 0 0 1-3-3V4a1 1 0 0 1 1-1Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgChartTrending2;
