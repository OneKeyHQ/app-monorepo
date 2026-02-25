import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgOnekeyPro = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12.25 11.042A2.48 2.48 0 1 1 12.249 16a2.48 2.48 0 0 1 .001-4.958m0 1.126a1.354 1.354 0 1 0 0 2.707 1.354 1.354 0 0 0 0-2.707"
      clipRule="evenodd"
    />
    <Path d="M12.956 10.582h-1.348V8.153h-1.207L10.782 7h2.174z" />
    <Path
      fillRule="evenodd"
      d="M17 2a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM7 19h10V4H7z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgOnekeyPro;
