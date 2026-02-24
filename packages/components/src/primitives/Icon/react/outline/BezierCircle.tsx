import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBezierCircle = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M15 4.585A8.02 8.02 0 0 1 19.415 9H22v6h-2.584A8.02 8.02 0 0 1 15 19.415V22H9v-2.585A8.02 8.02 0 0 1 4.584 15H2V9h2.585A8.02 8.02 0 0 1 9 4.585V2h6zM11 20h2v-2h-2zM9 6.802A6.04 6.04 0 0 0 6.8 9H8v6H6.802A6.04 6.04 0 0 0 9 17.197V16h6v1.197A6.04 6.04 0 0 0 17.197 15H16V9h1.198A6.04 6.04 0 0 0 15 6.803V8H9zM4 13h2v-2H4zm14 0h2v-2h-2zm-7-7h2V4h-2z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBezierCircle;
