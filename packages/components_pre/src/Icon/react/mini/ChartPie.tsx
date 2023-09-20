import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChartPie = (props: SvgProps) => (
  <Svg
    viewBox="0 0 20 20"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12 9a1 1 0 0 1-1-1V3c0-.553.45-1.008.997-.93a7.004 7.004 0 0 1 5.933 5.933c.078.547-.378.997-.93.997h-5z" />
    <Path d="M8.003 4.07C8.55 3.992 9 4.447 9 5v5a1 1 0 0 0 1 1h5c.552 0 1.008.45.93.997A7.001 7.001 0 0 1 2 11a7.002 7.002 0 0 1 6.003-6.93z" />
  </Svg>
);
export default SvgChartPie;
