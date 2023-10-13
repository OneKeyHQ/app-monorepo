import Svg, { SvgProps, Path, Rect } from 'react-native-svg';
const SvgInfoCircle = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M11 11h1v5m9-4a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
    />
    <Rect
      width={1.5}
      height={1.5}
      x={11.25}
      y={7.25}
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={0.5}
      rx={0.75}
    />
  </Svg>
);
export default SvgInfoCircle;
