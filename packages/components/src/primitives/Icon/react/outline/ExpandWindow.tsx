import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgExpandWindow = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12 22H2v-9h10zm-8-2h6v-5H4z"
      clipRule="evenodd"
    />
    <Path d="M22 16h-8v-2h6V5H5v6H3V3h19z" />
    <Path d="M18 12h-2v-1.586l-2 2L12.586 11l2-2H13V7h5z" />
  </Svg>
);
export default SvgExpandWindow;
