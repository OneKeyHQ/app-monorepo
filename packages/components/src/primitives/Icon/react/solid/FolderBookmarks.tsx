import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFolderBookmarks = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="m8 21.767-3.5-2.101-3.5 2.1V13h7zm-5-3.534 1.5-.899 1.5.9V15H3z"
      clipRule="evenodd"
    />
    <Path d="M12.535 6H22v14H10v-9H2V3h8.535z" />
  </Svg>
);
export default SvgFolderBookmarks;
