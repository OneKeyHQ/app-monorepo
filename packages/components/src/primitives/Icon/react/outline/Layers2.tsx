import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgLayers2 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="m23.06 9-5.402 2.999L23.06 15 12 21.144.94 15l5.4-3.001L.94 9 12 2.856zM12 15.144l-3.6-2L5.058 15 12 18.855 18.94 15l-3.34-1.856zM5.059 9 12 12.855 18.941 9 12 5.144z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgLayers2;
