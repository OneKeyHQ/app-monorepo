import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBookmarkDelete = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M15.536 7.879 13.414 10l2.122 2.121-1.415 1.415L12 11.414l-2.121 2.122-1.414-1.415L10.585 10l-2.12-2.121 1.414-1.414L12 8.585l2.121-2.12z" />
    <Path
      fillRule="evenodd"
      d="m20 22.724-8-4.573-8 4.573V2h16zM6 19.276l6-3.427 6 3.427V4H6z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBookmarkDelete;
