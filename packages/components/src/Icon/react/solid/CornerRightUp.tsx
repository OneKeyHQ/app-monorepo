import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCornerRightUp = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M11.293 6.793a1 1 0 0 0 1.414 1.414L15 5.914V16a3 3 0 0 1-3 3H4a1 1 0 1 0 0 2h8a5 5 0 0 0 5-5V5.914l2.293 2.293a1 1 0 1 0 1.414-1.414L17.414 3.5a2 2 0 0 0-2.828 0l-3.293 3.293Z"
    />
  </Svg>
);
export default SvgCornerRightUp;
