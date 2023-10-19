import Svg, { SvgProps, Path, Rect } from 'react-native-svg';
const SvgCameraGopro = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M7 16h3M9 5H5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-1m-6-4h4a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2Z"
    />
    <Rect
      width={1.75}
      height={1.75}
      x={16.125}
      y={8.125}
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={0.75}
      rx={0.875}
    />
  </Svg>
);
export default SvgCameraGopro;
