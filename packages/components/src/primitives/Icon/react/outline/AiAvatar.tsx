import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAiAvatar = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M3 5a2 2 0 0 1 2-2h6a1 1 0 1 1 0 2H5v14h2.1a5.002 5.002 0 0 1 9.8 0H19v-6a1 1 0 1 1 2 0v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zm6.17 14h5.66a3.001 3.001 0 0 0-5.66 0M12 9a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3m-3.5 1.5a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0"
      clipRule="evenodd"
    />
    <Path d="M18.947 1.894a.5.5 0 0 0-.894 0l-.979 1.957a.5.5 0 0 1-.223.224l-1.957.978a.5.5 0 0 0 0 .894l1.957.978a.5.5 0 0 1 .224.224l.978 1.957a.5.5 0 0 0 .894 0l.979-1.957a.5.5 0 0 1 .223-.224l1.957-.978a.5.5 0 0 0 0-.894l-1.957-.978a.5.5 0 0 1-.224-.224z" />
  </Svg>
);
export default SvgAiAvatar;
