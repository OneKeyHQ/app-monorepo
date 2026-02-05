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
      d="M11.008 5.046a1.985 1.985 0 0 1 2.409-1.94L19.37 4.41c.911.2 1.56 1.006 1.56 1.94v11.303c0 .932-.649 1.74-1.56 1.939l-5.954 1.302a1.985 1.985 0 0 1-2.41-1.939V5.046Zm7.939 1.302-5.955-1.302v13.908l5.955-1.302zM8.03 4.061c.548 0 .993.444.993.992v13.894a.992.992 0 1 1-1.985 0V5.053c0-.548.444-.992.992-.992m-3.97.992c.549 0 .993.444.993.993v11.908a.992.992 0 1 1-1.985 0V6.046c0-.549.445-.993.993-.993Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgAlbums;
