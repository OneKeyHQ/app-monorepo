import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCompassCircle = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10S2 17.523 2 12Zm12.524-3.753a1 1 0 0 1 1.228 1.228l-1.12 4.105a1.5 1.5 0 0 1-1.052 1.052l-4.105 1.12a1 1 0 0 1-1.228-1.228l1.12-4.105a1.5 1.5 0 0 1 1.052-1.052l4.105-1.12Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCompassCircle;
