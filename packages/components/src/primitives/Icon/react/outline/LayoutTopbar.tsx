import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgLayoutTopbar = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M21 21H3V3h18zM5 11v8h6v-8zm8 0v8h6v-8zM5 9h14V5H5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgLayoutTopbar;
