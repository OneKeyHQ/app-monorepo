import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCameraAuto = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12.697 14h-1.394L12 12.444z" />
    <Path
      fillRule="evenodd"
      d="M17.035 6H22v15H2V6h4.965l2-3h6.07zM7.838 16.84a1 1 0 0 0-.057.16h2.177l.448-1h3.188l.448 1h2.177a1 1 0 0 0-.057-.16L13.096 10h-2.192z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCameraAuto;
