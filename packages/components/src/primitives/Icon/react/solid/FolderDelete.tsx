import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFolderDelete = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M2 5a2 2 0 0 1 2-2h5.465a2 2 0 0 1 1.664.89L12.535 6H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9.83a3 3 0 0 0-.594-3A3 3 0 0 0 5 12.764a3 3 0 0 0-3-.593z"
      clipRule="evenodd"
    />
    <Path
      fillRule="evenodd"
      d="M7.707 14.293a1 1 0 0 1 0 1.414L6.414 17l1.293 1.293a1 1 0 1 1-1.414 1.414L5 18.414l-1.293 1.293a1 1 0 0 1-1.414-1.414L3.586 17l-1.293-1.293a1 1 0 1 1 1.414-1.414L5 15.586l1.293-1.293a1 1 0 0 1 1.414 0"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgFolderDelete;
