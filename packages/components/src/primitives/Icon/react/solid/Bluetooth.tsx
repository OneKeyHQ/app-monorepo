import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBluetooth = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M9.83 3.551c0-1.302 1.508-2.026 2.525-1.213l5.29 4.232a1.553 1.553 0 0 1 0 2.426L13.89 12l3.755 3.004a1.554 1.554 0 0 1 0 2.426l-5.29 4.232c-1.018.813-2.524.09-2.524-1.213v-5.202l-3.558 2.847a1.054 1.054 0 0 1-1.318-1.646l4.876-3.9v-1.095l-4.876-3.9a1.054 1.054 0 0 1 1.318-1.647L9.83 8.753V3.55Zm2.373 7.099-.264-.21V4.705l3.847 3.077zm0 2.7-.264.21v5.734l3.847-3.077z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBluetooth;
