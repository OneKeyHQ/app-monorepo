import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFolderBookmarks = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M7 13a1 1 0 0 1 1 1v6a1 1 0 0 1-1.515.858L4.5 19.666l-1.985 1.192A1.001 1.001 0 0 1 1 20v-6a1 1 0 0 1 1-1zm-4 5.233.985-.59.122-.063a1 1 0 0 1 .908.063l.985.59V15H3zM2 10V5a2 2 0 0 1 2-2h5.465a2 2 0 0 1 1.664.89L12.535 6H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-9a1 1 0 1 1 0-2h9V8h-7.465a2 2 0 0 1-1.664-.89L9.465 5H4v5a1 1 0 1 1-2 0" />
  </Svg>
);
export default SvgFolderBookmarks;
