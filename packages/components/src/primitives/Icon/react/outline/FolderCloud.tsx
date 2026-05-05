import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFolderCloud = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M5.25 12.5c1.319 0 2.492.602 3.269 1.538A3.5 3.5 0 0 1 8 21H5.25a4.25 4.25 0 0 1 0-8.5m0 2a2.25 2.25 0 0 0 0 4.5H8a1.5 1.5 0 0 0 0-3h-.562l-.294-.46A2.24 2.24 0 0 0 5.25 14.5"
      clipRule="evenodd"
    />
    <Path d="M12.535 6H22v14h-9v-2h7V8h-8.535l-2-3H4v6H2V3h8.535z" />
  </Svg>
);
export default SvgFolderCloud;
