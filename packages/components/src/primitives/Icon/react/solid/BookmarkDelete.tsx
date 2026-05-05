import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBookmarkDelete = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M20 2v20.724l-8-4.573-8 4.573V2zm-8 6.586L9.879 6.465 8.465 7.879 10.585 10l-2.12 2.121 1.414 1.414L12 11.415l2.121 2.12 1.414-1.414L13.415 10l2.12-2.121-1.414-1.414z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBookmarkDelete;
