import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgOnekeyPro = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12.25 12.168a1.354 1.354 0 1 1 0 2.707 1.354 1.354 0 0 1 0-2.707" />
    <Path
      fillRule="evenodd"
      d="M18 2a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm-5.75 9.042A2.48 2.48 0 1 0 12.251 16a2.48 2.48 0 0 0-.001-4.958m-1.849-2.889h1.207v2.429h1.348V7h-2.174l-.38 1.153Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgOnekeyPro;
