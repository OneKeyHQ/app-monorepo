import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAlbums = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M21 4.67v14.66l-10 1.875V2.795zm-8 14.125 6-1.125V6.33l-6-1.125z"
      clipRule="evenodd"
    />
    <Path d="M9 20H7V4h2zm-4-1H3V5h2z" />
  </Svg>
);
export default SvgAlbums;
