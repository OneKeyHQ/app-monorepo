import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAlbums = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M11.008 5.045a1.985 1.985 0 0 1 2.409-1.938l5.954 1.302c.911.2 1.56 1.006 1.56 1.939V17.65c0 .933-.649 1.74-1.56 1.94l-5.954 1.302a1.985 1.985 0 0 1-2.41-1.939V5.045Zm-3.97 13.901V5.053a.993.993 0 0 1 1.985 0v13.893a.992.992 0 1 1-1.985 0m-3.97-.992V6.045a.993.993 0 0 1 1.985 0v11.909a.992.992 0 1 1-1.985 0m9.924 1 5.955-1.303V6.348l-5.955-1.303z" />
  </Svg>
);
export default SvgAlbums;
