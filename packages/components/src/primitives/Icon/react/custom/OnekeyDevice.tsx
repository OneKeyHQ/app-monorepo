import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgOnekeyDevice = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M7.75 2a3 3 0 0 0-3 3v14a3 3 0 0 0 3 3h8.5a3 3 0 0 0 3-3V5a3 3 0 0 0-3-3zm-1 3a1 1 0 0 1 1-1h8.5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-8.5a1 1 0 0 1-1-1z"
      clipRule="evenodd"
    />
    <Path
      fill="currentColor"
      d="M12.956 7h-2.174l-.38 1.153h1.206v2.429h1.348z"
    />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M14.729 13.521a2.479 2.479 0 1 1-4.958 0 2.479 2.479 0 0 1 4.958 0m-2.479 1.354a1.353 1.353 0 1 0 0-2.707 1.353 1.353 0 0 0 0 2.707"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgOnekeyDevice;
