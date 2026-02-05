import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAiAvatar = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M18.947 1.894a.5.5 0 0 0-.894 0l-.979 1.957a.5.5 0 0 1-.223.224l-1.957.978a.5.5 0 0 0 0 .894l1.957.978a.5.5 0 0 1 .224.224l.978 1.957a.5.5 0 0 0 .894 0l.979-1.957a.5.5 0 0 1 .223-.224l1.957-.978a.5.5 0 0 0 0-.894l-1.957-.978a.5.5 0 0 1-.224-.224z" />
    <Path
      fillRule="evenodd"
      d="M5 3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a1 1 0 1 0-2 0v6h-2.1a5.002 5.002 0 0 0-9.8 0H5V5h6a1 1 0 1 0 0-2z"
      clipRule="evenodd"
    />
    <Path d="M12 7.5a3 3 0 1 0 0 6 3 3 0 0 0 0-6" />
  </Svg>
);
export default SvgAiAvatar;
