import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgArrowSmDown = (props: SvgProps) => (
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
      d="m17 13-5 5m0 0-5-5m5 5V6"
    />
  </Svg>
);
export default SvgArrowSmDown;
