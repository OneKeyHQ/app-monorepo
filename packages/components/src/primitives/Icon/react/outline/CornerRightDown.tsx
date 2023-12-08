import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCornerRightDown = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 4h8a4 4 0 0 1 4 4v11.75m-4-3.25 3.293 3.293a1 1 0 0 0 1.414 0L20 16.5"
    />
  </Svg>
);
export default SvgCornerRightDown;
