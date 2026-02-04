import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBluetooth = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M9.831 3.552c0-1.262 1.414-1.981 2.427-1.286l.097.072 5.29 4.232a1.554 1.554 0 0 1 0 2.427l-3.755 3.002 3.754 3.004a1.554 1.554 0 0 1 0 2.427l-5.289 4.232c-1.017.814-2.524.09-2.524-1.213v-5.202l-3.559 2.847a1.054 1.054 0 1 1-1.316-1.646l4.875-3.901v-1.095l-4.875-3.9a1.054 1.054 0 1 1 1.316-1.646l3.56 2.847V3.552ZM11.94 13.56v5.733l3.846-3.077-3.583-2.867zm0-3.122.263.21 3.583-2.866-3.846-3.078z" />
  </Svg>
);
export default SvgBluetooth;
