import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPackageBlock = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7.81A6.5 6.5 0 0 1 21 11.022V5a2 2 0 0 0-2-2h-3v4a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2z" />
    <Path d="M14 3h-4v4h4z" />
    <Path
      fillRule="evenodd"
      d="M20.682 13.318a4.5 4.5 0 1 0-6.364 6.364 4.5 4.5 0 0 0 6.364-6.364m-.854 4.096-3.242-3.242a2.5 2.5 0 0 1 3.242 3.242m-4.656-1.828 3.242 3.242a2.5 2.5 0 0 1-3.242-3.242"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPackageBlock;
