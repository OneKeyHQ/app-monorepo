import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCryptoCoin = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={2}
      d="M12 7v1m0 8v1m2.5-7.45a3.5 3.5 0 1 0 0 4.899M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
    />
  </Svg>
);
export default SvgCryptoCoin;
