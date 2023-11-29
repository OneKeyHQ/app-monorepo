import Svg, { SvgProps, Rect, Path } from 'react-native-svg';
const SvgDice3 = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Rect
      width={16}
      height={16}
      x={4}
      y={4}
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth={2}
      rx={2}
    />
    <Path
      fill="currentColor"
      d="M13.5 12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm-4-4a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm8 8a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z"
    />
  </Svg>
);
export default SvgDice3;
