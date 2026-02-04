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
      d="M2 5a2 2 0 0 1 2-2h5.465a2 2 0 0 1 1.664.89L12.535 6H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H10v-8a1 1 0 0 0-1-1H2z"
      clipRule="evenodd"
    />
    <Path
      fillRule="evenodd"
      d="M1 14a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v6a1 1 0 0 1-1.514.858L4.5 19.666l-1.986 1.192A1 1 0 0 1 1 20zm2 1v3.234l.986-.592a1 1 0 0 1 1.028 0l.986.592V15z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgFolderBookmarks;
