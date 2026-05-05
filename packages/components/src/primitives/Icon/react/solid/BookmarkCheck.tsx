import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBookmarkCheck = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="m20 22.724-8-4.573-8 4.573V2h16zm-9-12.388-1.5-1.5-1.414 1.414L11 13.164l4.914-4.914L14.5 6.836z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBookmarkCheck;
