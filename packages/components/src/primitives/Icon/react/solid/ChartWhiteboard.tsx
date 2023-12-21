import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChartWhiteboard = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M13 3a1 1 0 1 0-2 0v1H5a3 3 0 0 0-3 3v9a3 3 0 0 0 3 3h1.613l-.562 1.684a1 1 0 0 0 1.898.632L8.72 19H11v1a1 1 0 1 0 2 0v-1h2.28l.771 2.316a1 1 0 0 0 1.898-.632L17.387 19H19a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3h-6V3Z"
    />
  </Svg>
);
export default SvgChartWhiteboard;
