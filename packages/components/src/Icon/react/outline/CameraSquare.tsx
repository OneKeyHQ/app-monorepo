import Svg, { SvgProps, Path, Rect } from 'react-native-svg';
const SvgCameraSquare = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Z"
    />
    <Path
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
    />
    <Rect
      width={1.75}
      height={1.75}
      x={16.625}
      y={6.625}
      fill="currentColor"
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth={0.75}
      rx={0.875}
    />
  </Svg>
);
export default SvgCameraSquare;
