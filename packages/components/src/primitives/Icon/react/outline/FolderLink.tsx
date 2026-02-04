import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFolderLink = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M1 17a4 4 0 0 1 4-4 1 1 0 1 1 0 2 2 2 0 1 0 0 4 1 1 0 1 1 0 2 4 4 0 0 1-4-4m9 0a2 2 0 0 0-2-2 1 1 0 1 1 0-2 4 4 0 0 1 0 8 1 1 0 1 1 0-2 2 2 0 0 0 2-2m-3-1a1 1 0 1 1 0 2H6a1 1 0 1 1 0-2zm-5-6V5a2 2 0 0 1 2-2h5.465a2 2 0 0 1 1.664.89L12.535 6H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-5a1 1 0 1 1 0-2h5V8h-7.465a2 2 0 0 1-1.664-.89L9.465 5H4v5a1 1 0 1 1-2 0" />
  </Svg>
);
export default SvgFolderLink;
