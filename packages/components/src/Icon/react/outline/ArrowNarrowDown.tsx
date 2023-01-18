import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgArrowNarrowDown = (props: SvgProps) => (
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
      d="m16 17-4 4m0 0-4-4m4 4V3"
    />
  </Svg>
);
export default SvgArrowNarrowDown;
