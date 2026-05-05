import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMessageX = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M21.002 19.036h-5.626l-3.382 2.802-3.343-2.802H3.002V3h18zM12 9.586l-2-2L8.586 9l2 2-2 2L10 14.414l2-2 2 2L15.414 13l-2-2 2-2L14 7.586z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMessageX;
