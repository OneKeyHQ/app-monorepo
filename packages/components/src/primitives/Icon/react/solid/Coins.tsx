import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCoins = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M13.959 5.06a9.001 9.001 0 0 0-7.613 11.42A7.002 7.002 0 0 1 9 3c1.938 0 3.692.787 4.959 2.06Z" />
    <Path d="M22 14a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" />
  </Svg>
);
export default SvgCoins;
