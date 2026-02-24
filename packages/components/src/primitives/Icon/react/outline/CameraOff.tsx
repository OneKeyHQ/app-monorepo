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
      d="M22.414 21 21 22.414 19.586 21H2V6h2.586l-3-3L3 1.586zM4 19h13.586l-2.974-2.974C13.912 16.631 13 17 12 17a4 4 0 0 1-3.027-6.613L6.586 8H4zm6-6a2 2 0 0 0 3.191 1.605l-2.797-2.798A2 2 0 0 0 10 13"
      clipRule="evenodd"
    />
    <Path d="M20 8h-4.035l-2-3H8.5V3h6.535l2 3H22v10h-2z" />
  </Svg>
);
export default SvgCameraOff;
