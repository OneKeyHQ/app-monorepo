import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCheckLarge = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M21.59 3.193a1 1 0 0 1 .217 1.398l-11.706 16a1 1 0 0 1-1.429.192l-6.294-5a1 1 0 1 1 1.244-1.566l5.48 4.353 11.09-15.16a1 1 0 0 1 1.397-.217Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCheckLarge;
