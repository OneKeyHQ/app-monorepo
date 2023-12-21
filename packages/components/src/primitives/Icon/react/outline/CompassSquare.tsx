import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCompassSquare = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6Z"
    />
    <Path
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M14.656 8.73 10.55 9.85a1 1 0 0 0-.701.701l-1.12 4.105a.5.5 0 0 0 .614.614l4.105-1.12a1 1 0 0 0 .701-.701l1.12-4.105a.5.5 0 0 0-.614-.614Z"
    />
  </Svg>
);
export default SvgCompassSquare;
