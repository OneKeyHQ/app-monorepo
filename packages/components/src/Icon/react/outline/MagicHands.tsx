import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMagicHands = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4.853 8.401A8 8 0 0 1 12 4a8 8 0 0 1 7.147 4.401M7.705 9.438A4.997 4.997 0 0 1 12 7c1.825 0 3.422.978 4.295 2.438m-9.313 4.374.257.705.47-.17a1 1 0 0 1 1.281.597 3 3 0 0 1-5.638 2.052l-.599-1.644a2.25 2.25 0 0 1 4.23-1.54Zm10.036 0-.256.705-.47-.17a1 1 0 0 0-1.282.597 3 3 0 1 0 5.638 2.052l.599-1.644a2.25 2.25 0 1 0-4.229-1.54Z"
    />
  </Svg>
);
export default SvgMagicHands;
