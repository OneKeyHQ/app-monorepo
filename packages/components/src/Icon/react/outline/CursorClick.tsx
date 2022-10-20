import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCursorClick = (props: SvgProps) => (
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
      d="m15 15-2 5L9 9l11 4-5 2zm0 0 5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656-2.12 2.122"
    />
  </Svg>
);
export default SvgCursorClick;
