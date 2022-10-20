import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgArrowNarrowLeft = (props: SvgProps) => (
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
      d="m7 16-4-4m0 0 4-4m-4 4h18"
    />
  </Svg>
);
export default SvgArrowNarrowLeft;
