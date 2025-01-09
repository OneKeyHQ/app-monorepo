import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCornerRightUp = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 20h8a4 4 0 0 0 4-4V4.25M12 7.5l3.293-3.293a1 1 0 0 1 1.414 0L20 7.5"
    />
  </Svg>
);
export default SvgCornerRightUp;
