import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgArrowNarrowRight = (props: SvgProps) => (
  <Svg
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m17 8 4 4m0 0-4 4m4-4H3"
    />
  </Svg>
);
export default SvgArrowNarrowRight;
