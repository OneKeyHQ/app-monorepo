import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgControlKey = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M21 21H3V3h18zM10.586 10 12 11.414l2-2 2 2L17.414 10 14 6.586z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgControlKey;
