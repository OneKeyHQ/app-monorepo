import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgArrowTriangleLeft = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 17.002V6.998c0-1.483-1.561-2.448-2.889-1.785L6.103 10.215c-1.47.736-1.47 2.834 0 3.57l10.008 5.002C17.44 19.45 19 18.485 19 17.002Z"
    />
  </Svg>
);
export default SvgArrowTriangleLeft;
