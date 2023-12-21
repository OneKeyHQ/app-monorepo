import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgWifi = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M21 8.073c-5.249-4.097-12.751-4.097-18 0m3.751 5.241c3.062-2.388 7.437-2.388 10.499 0"
    />
    <Path
      fill="currentColor"
      stroke="currentColor"
      strokeLinecap="square"
      strokeWidth={0.75}
      d="M11.126 18.75a.875.875 0 1 0 1.75 0 .875.875 0 0 0-1.75 0Z"
    />
  </Svg>
);
export default SvgWifi;
