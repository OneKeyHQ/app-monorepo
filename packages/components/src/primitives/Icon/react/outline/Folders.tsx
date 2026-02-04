import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFolders = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M1 19V9a2 2 0 0 1 2-2h2V5a2 2 0 0 1 2-2h4.586l.197.01A2 2 0 0 1 13 3.586L14.414 5H21a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2v2a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2m2 0h14v-8h-6.586A2 2 0 0 1 9 10.414L7.586 9H3zM7 7h.586A2 2 0 0 1 9 7.586L10.414 9H17a2 2 0 0 1 2 2v4h2V7h-6.586A2 2 0 0 1 13 6.414L11.586 5H7z" />
  </Svg>
);
export default SvgFolders;
