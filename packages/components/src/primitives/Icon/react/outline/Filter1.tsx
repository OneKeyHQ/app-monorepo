import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFilter1 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="m21 8.414-6 6v6.367l-.758.189L9 22.28v-7.867l-6-6V3h18zM5 7.586l6 6v6.134l2-.5v-5.634l6-6V5H5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgFilter1;
