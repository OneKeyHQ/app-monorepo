import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgOnekeyPro = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12 12.168a1.354 1.354 0 1 1 0 2.707 1.354 1.354 0 0 1 0-2.707" />
    <Path
      fillRule="evenodd"
      d="M17 2a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm-5 9.042A2.48 2.48 0 1 0 12.001 16 2.48 2.48 0 0 0 12 11.042m-1.849-2.889h1.207v2.429h1.348V7h-2.174z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgOnekeyPro;
