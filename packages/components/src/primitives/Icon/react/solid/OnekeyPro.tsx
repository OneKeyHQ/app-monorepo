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
      fillOpacity={0.875}
      fillRule="evenodd"
      d="M7.75 2a3 3 0 0 0-3 3v14a3 3 0 0 0 3 3h8.5a3 3 0 0 0 3-3V5a3 3 0 0 0-3-3zm4.5 14a2.479 2.479 0 1 0 0-4.958 2.479 2.479 0 0 0 0 4.958m0-1.125a1.353 1.353 0 1 0 0-2.707 1.353 1.353 0 0 0 0 2.707M12.956 7h-2.174l-.38 1.153h1.206v2.429h1.348z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgOnekeyPro;
