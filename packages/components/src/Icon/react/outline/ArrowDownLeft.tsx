import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgArrowDownLeft = (props: SvgProps) => (
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
      d="m19.5 4.5-15 15m0 0h11.25m-11.25 0V8.25"
    />
  </Svg>
);
export default SvgArrowDownLeft;
