import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFolderUser = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M6 16c1.76 0 3.306.91 4.196 2.28a1.69 1.69 0 0 1-.024 1.906A1.93 1.93 0 0 1 8.584 21H3.416c-.644 0-1.238-.31-1.587-.814a1.69 1.69 0 0 1-.024-1.907A5 5 0 0 1 6 16m0 2a3 3 0 0 0-2.234 1h4.468A3 3 0 0 0 6 18m.75-5.5a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0M2 7V5a2 2 0 0 1 2-2h5.465l.125.004a2 2 0 0 1 1.539.887L12.535 6H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-6a1 1 0 0 1 0-2h6V8h-7.465a2 2 0 0 1-1.664-.89L9.465 5H4v2a1 1 0 1 1-2 0m6.75 5.5a2.75 2.75 0 1 1-5.5 0 2.75 2.75 0 0 1 5.5 0" />
  </Svg>
);
export default SvgFolderUser;
