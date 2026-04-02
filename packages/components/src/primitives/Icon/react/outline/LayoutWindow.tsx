import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgLayoutWindow = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M21 21H3V3h18zM5 13v6h6v-6zm8 0v6h6v-6zm-8-2h6V5H5zm8 0h6V5h-6z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgLayoutWindow;
