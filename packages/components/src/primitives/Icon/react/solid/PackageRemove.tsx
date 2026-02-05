import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPackageRemove = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8.713a3 3 0 0 1 .544-3.5 3 3 0 1 1 4.243-4.243 3 3 0 0 1 2.5-.854V5a2 2 0 0 0-2-2h-3v4a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2z" />
    <Path d="M14 3h-4v4h4zm7.328 13.086a1 1 0 0 0-1.414-1.414L18.5 16.086l-1.414-1.414a1 1 0 1 0-1.414 1.414l1.414 1.414-1.414 1.414a1 1 0 1 0 1.414 1.414l1.414-1.414 1.414 1.414a1 1 0 0 0 1.414-1.414L19.914 17.5z" />
  </Svg>
);
export default SvgPackageRemove;
