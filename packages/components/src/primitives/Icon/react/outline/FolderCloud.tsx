import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFolderCloud = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M2 10V5a2 2 0 0 1 2-2h5.465a2 2 0 0 1 1.664.89L12.535 6H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-6a1 1 0 1 1 0-2h6V8h-7.465a2 2 0 0 1-1.664-.89L9.465 5H4v5a1 1 0 1 1-2 0" />
    <Path d="M1 16.75a4.25 4.25 0 0 1 7.521-2.712A3.501 3.501 0 0 1 8 21H5.25A4.25 4.25 0 0 1 1 16.75m2 0A2.25 2.25 0 0 0 5.25 19H8a1.5 1.5 0 0 0 0-3h-.009a1 1 0 0 1-.845-.46A2.25 2.25 0 0 0 3 16.75" />
  </Svg>
);
export default SvgFolderCloud;
