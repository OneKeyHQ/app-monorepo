import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFolders = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M7 3a2 2 0 0 0-2 2v2H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2h2a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-6.586L13 3.586A2 2 0 0 0 11.586 3zm12 12h2V7h-6.586A2 2 0 0 1 13 6.414L11.586 5H7v2h.586A2 2 0 0 1 9 7.586L10.414 9H17a2 2 0 0 1 2 2z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgFolders;
