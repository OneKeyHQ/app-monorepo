import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChartTrendingUp = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M15 7a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0V9.414l-4.879 4.879a3 3 0 0 1-4.242 0L9.707 13.12a1 1 0 0 0-1.414 0l-4.586 4.586a1 1 0 0 1-1.414-1.414l4.586-4.586a3 3 0 0 1 4.242 0l1.172 1.172a1 1 0 0 0 1.414 0L18.586 8H16a1 1 0 0 1-1-1Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgChartTrendingUp;
