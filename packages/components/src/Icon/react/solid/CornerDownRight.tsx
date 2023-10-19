import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCornerDownRight = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M5 5a1 1 0 0 0-2 0v6a5 5 0 0 0 5 5h10.086l-2.293 2.293a1 1 0 0 0 1.414 1.414l3.293-3.293a2 2 0 0 0 0-2.828l-3.293-3.293a1 1 0 1 0-1.414 1.414L18.086 14H8a3 3 0 0 1-3-3V5Z"
    />
  </Svg>
);
export default SvgCornerDownRight;
