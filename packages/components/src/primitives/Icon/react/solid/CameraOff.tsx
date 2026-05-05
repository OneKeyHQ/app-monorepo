import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCameraOff = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M22.414 21 21 22.414 19.586 21H2V6h2.586l-3-3L3 1.586zM9.11 10.524a3.5 3.5 0 0 0 4.865 4.865z"
      clipRule="evenodd"
    />
    <Path d="M17.035 6H22v11.758L8.276 4.033 8.965 3h6.07z" />
  </Svg>
);
export default SvgCameraOff;
