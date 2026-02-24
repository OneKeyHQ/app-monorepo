import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCamera = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M17.035 6H22v15H2V6h4.965l2-3h6.07zM12 9a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCamera;
