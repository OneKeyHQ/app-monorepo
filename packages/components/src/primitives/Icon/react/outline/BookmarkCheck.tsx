import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBookmarkCheck = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M15.914 8.25 11 13.164 8.086 10.25 9.5 8.836l1.5 1.5 3.5-3.5z" />
    <Path
      fillRule="evenodd"
      d="m20 22.724-8-4.573-8 4.573V2h16zM6 19.276l6-3.427 6 3.427V4H6z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBookmarkCheck;
