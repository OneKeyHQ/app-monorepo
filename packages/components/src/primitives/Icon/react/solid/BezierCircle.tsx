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
      d="M15 2v2.582A8.02 8.02 0 0 1 19.418 9H22v6h-2.582A8.02 8.02 0 0 1 15 19.418V22H9v-2.582A8.02 8.02 0 0 1 4.582 15H2V9h2.582A8.02 8.02 0 0 1 9 4.582V2zm0 6H9V6.803A6.03 6.03 0 0 0 6.803 9H8v6H6.803A6.03 6.03 0 0 0 9 17.197V16h6v1.197A6.04 6.04 0 0 0 17.197 15H16V9h1.197A6.03 6.03 0 0 0 15 6.803z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBezierCircle;
