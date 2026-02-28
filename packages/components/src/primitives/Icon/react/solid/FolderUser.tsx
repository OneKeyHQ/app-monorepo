import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFolderUser = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M6 16a5 5 0 0 1 5 5H1a5 5 0 0 1 5-5m0 2c-.888 0-1.687.386-2.236 1h4.472A3 3 0 0 0 6 18"
      clipRule="evenodd"
    />
    <Path d="M12.535 6H22v14h-9.071a7 7 0 0 0-.512-1.8 7.03 7.03 0 0 0-2.505-3.006A4.75 4.75 0 1 0 2 9.937V3h8.535zM2.088 15.194l-.088.06v-.191z" />
    <Path
      fillRule="evenodd"
      d="M6 9.75a2.75 2.75 0 1 1 0 5.5 2.75 2.75 0 0 1 0-5.5m0 2a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgFolderUser;
