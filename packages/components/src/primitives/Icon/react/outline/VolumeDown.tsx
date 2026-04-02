import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgVolumeDown = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M13 20.929 5.747 17H1V7h4.747L13 3.071V20.93ZM6.477 8.879 6.254 9H3v6h3.254l.223.121L11 17.571V6.43L6.477 8.88Z"
      clipRule="evenodd"
    />
    <Path d="M23 13h-8v-2h8z" />
  </Svg>
);
export default SvgVolumeDown;
