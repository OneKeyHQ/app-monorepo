import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFolderLink = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M4 3a2 2 0 0 0-2 2v6.803A6 6 0 0 1 5 11h3a6 6 0 0 1 5.197 9H20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.465L11.13 3.89A2 2 0 0 0 9.465 3z" />
    <Path d="M8 13a1 1 0 1 0 0 2 2 2 0 1 1 0 4 1 1 0 1 0 0 2 4 4 0 0 0 0-8m-3 0a4 4 0 0 0 0 8 1 1 0 1 0 0-2 2 2 0 1 1 0-4 1 1 0 1 0 0-2" />
    <Path d="M6 16a1 1 0 1 0 0 2h1a1 1 0 1 0 0-2z" />
  </Svg>
);
export default SvgFolderLink;
