import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgLayoutSearch = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M14.172 14.172a4 4 0 0 1 6.274 4.86l1.968 1.969L21 22.415l-1.969-1.969a4 4 0 0 1-4.86-6.274Zm4.242 1.414a2 2 0 1 0-2.828 2.83 2 2 0 0 0 2.828-2.83M11 21H3v-8h8zm-6-2h4v-4H5zm6-8H3V3h8zM5 9h4V5H5zm16 2h-8V3h8zm-6-2h4V5h-4z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgLayoutSearch;
