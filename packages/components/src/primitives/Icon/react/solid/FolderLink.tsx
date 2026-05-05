import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFolderLink = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M6 15H5a2 2 0 1 0 0 4h1v2H5a4 4 0 0 1 0-8h1zm2-2a4 4 0 0 1 0 8H7v-2h1a2 2 0 1 0 0-4H7v-2z" />
    <Path d="M12.535 6H22v14h-8.803A6 6 0 0 0 8 11H5a6 6 0 0 0-3 .803V3h8.535z" />
    <Path d="M8 16v2H5v-2z" />
  </Svg>
);
export default SvgFolderLink;
