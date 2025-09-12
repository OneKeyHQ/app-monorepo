import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgOnekeyKeytag = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M3 6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3zm16 12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1z"
      clipRule="evenodd"
    />
    <Path d="M16 17.25a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5m-6.75-9a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0M12 9.5A1.25 1.25 0 1 0 12 7a1.25 1.25 0 0 0 0 2.5m4 0A1.25 1.25 0 1 0 16 7a1.25 1.25 0 0 0 0 2.5m-6.75 2.75a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0M12 13.5a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5m4 0a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5m-4 3.75a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5M9.25 16a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0" />
  </Svg>
);
export default SvgOnekeyKeytag;
