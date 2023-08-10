import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgArrowUpLeft = (props: SvgProps) => (
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
      d="m19.5 19.5-15-15m0 0v11.25m0-11.25h11.25"
    />
  </Svg>
);
export default SvgArrowUpLeft;
