import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDocumentSearch1 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M14.172 15.172a4 4 0 0 1 6.274 4.86L22.414 22 21 23.414l-1.968-1.968a4.001 4.001 0 0 1-4.86-6.274m4.242 1.414a2 2 0 1 0-2.828 2.828 2 2 0 0 0 2.828-2.828"
      clipRule="evenodd"
    />
    <Path d="M20 12h-2V4H5v16h6v2H3V2h17z" />
    <Path d="M10 16H7v-2h3zm2-4H7v-2h5zm4-4H7V6h9z" />
  </Svg>
);
export default SvgDocumentSearch1;
