import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPackageEdit = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7.17c-.11-.313-.17-.65-.17-1v-2.333a3 3 0 0 1 .879-2.122l3.5-3.5A4.65 4.65 0 0 1 21 10.878V5a2 2 0 0 0-2-2h-3v4a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2z" />
    <Path d="M14 3h-4v4h4z" />
    <Path
      fillRule="evenodd"
      d="M21.54 13.46a2.65 2.65 0 0 0-3.747 0l-3.5 3.5a1 1 0 0 0-.293.707V20a1 1 0 0 0 1 1h2.333a1 1 0 0 0 .707-.293l3.5-3.5a2.65 2.65 0 0 0 0-3.747m-2.333 1.414a.65.65 0 0 1 .92.919L16.918 19H16v-.92z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPackageEdit;
