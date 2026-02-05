import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFolderDelete = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M6.293 14.293a1 1 0 1 1 1.414 1.414L6.414 17l1.293 1.293a1 1 0 1 1-1.414 1.414L5 18.414l-1.293 1.293a1 1 0 1 1-1.414-1.414L3.586 17l-1.293-1.293a1 1 0 1 1 1.414-1.414L5 15.586zM2 11V5a2 2 0 0 1 2-2h5.465a2 2 0 0 1 1.664.89L12.535 6H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-9a1 1 0 1 1 0-2h9V8h-7.465a2 2 0 0 1-1.664-.89L9.465 5H4v6a1 1 0 1 1-2 0" />
  </Svg>
);
export default SvgFolderDelete;
