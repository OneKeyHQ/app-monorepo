import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgControllerRoundDown = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="square"
      strokeWidth={2}
      d="M5.75 14.75a2.75 2.75 0 1 0 0-5.5 2.75 2.75 0 0 0 0 5.5Zm12.5 0a2.75 2.75 0 1 0 0-5.5 2.75 2.75 0 0 0 0 5.5ZM12 8.5A2.75 2.75 0 1 0 12 3a2.75 2.75 0 0 0 0 5.5Z"
    />
    <Path
      fill="currentColor"
      stroke="currentColor"
      strokeLinecap="square"
      strokeWidth={2}
      d="M12 21a2.75 2.75 0 1 0 0-5.5 2.75 2.75 0 0 0 0 5.5Z"
    />
  </Svg>
);
export default SvgControllerRoundDown;
