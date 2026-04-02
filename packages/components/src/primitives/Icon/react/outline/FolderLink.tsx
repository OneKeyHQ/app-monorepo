import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFolderLink = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M6 15H5a2 2 0 1 0 0 4h1v2H5a4 4 0 1 1 0-8h1zm2-2a4 4 0 1 1 0 8H7v-2h1a2 2 0 1 0 0-4H7v-2z" />
    <Path d="M12.535 6H22v14h-8v-2h6V8h-8.535l-2-3H4v6H2V3h8.535zM8 18H5v-2h3z" />
  </Svg>
);
export default SvgFolderLink;
