import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMessageCheck = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M21.002 19.036h-5.626l-3.382 2.802-3.343-2.802H3.002V3h18zm-9.752-7.7-1.5-1.5-1.414 1.414 2.914 2.914 4.914-4.914-1.414-1.414z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMessageCheck;
