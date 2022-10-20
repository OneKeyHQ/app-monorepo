import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChartPie = (props: SvgProps) => (
  <Svg
    viewBox="0 0 20 20"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M2 10a8 8 0 0 1 8-8v8h8a8 8 0 1 1-16 0z" />
    <Path d="M12 2.252A8.014 8.014 0 0 1 17.748 8H12V2.252z" />
  </Svg>
);
export default SvgChartPie;
