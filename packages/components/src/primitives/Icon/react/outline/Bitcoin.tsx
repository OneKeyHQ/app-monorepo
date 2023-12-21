import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBitcoin = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M10 8.5V12m0-3.5h3.25a1.75 1.75 0 1 1 0 3.5M10 8.5H8.5M10 12v3.5m0-3.5h3.25M10 15.5H8.5m1.5 0h3.25a1.75 1.75 0 1 0 0-3.5M12 7v1.5m0 7V17m9-5a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
    />
  </Svg>
);
export default SvgBitcoin;
