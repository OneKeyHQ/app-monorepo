import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCornerRightDown = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M4 5a1 1 0 0 1 0-2h8a5 5 0 0 1 5 5v10.086l2.293-2.293a1 1 0 0 1 1.414 1.414L17.414 20.5a2 2 0 0 1-2.828 0l-3.293-3.293a1 1 0 0 1 1.414-1.414L15 18.086V8a3 3 0 0 0-3-3H4Z"
    />
  </Svg>
);
export default SvgCornerRightDown;
