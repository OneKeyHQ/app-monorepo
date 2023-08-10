import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgArrowUturnDown = (props: SvgProps) => (
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
      d="m15 15-6 6m0 0-6-6m6 6V9a6 6 0 0 1 12 0v3"
    />
  </Svg>
);
export default SvgArrowUturnDown;
