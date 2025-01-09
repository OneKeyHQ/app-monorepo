import Svg, { SvgProps, Path, Rect } from 'react-native-svg';
const SvgError = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 9.02v2.993M10.277 3.99 3.275 15.998C2.499 17.328 3.458 19 4.998 19h14.004c1.54 0 2.5-1.671 1.723-3.002L13.723 3.99c-.77-1.32-2.677-1.32-3.447 0Z"
    />
    <Rect
      width={2.5}
      height={2.5}
      x={10.75}
      y={13.75}
      fill="currentColor"
      rx={1.25}
    />
  </Svg>
);
export default SvgError;
