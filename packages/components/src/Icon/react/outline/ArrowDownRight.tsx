import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgArrowDownRight = (props: SvgProps) => (
  <Svg
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="m4.5 4.5 15 15m0 0V8.25m0 11.25H8.25"
    />
  </Svg>
);
export default SvgArrowDownRight;
