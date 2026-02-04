import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBusiness = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M3.326 4.403A2 2 0 0 1 5.236 3h13.529a2 2 0 0 1 1.909 1.403l1.105 3.536A3.88 3.88 0 0 1 21 11.66V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7.34a3.88 3.88 0 0 1-.779-3.72zm10.748 4.248L13.617 5h-3.234l-.457 3.651a2.09 2.09 0 1 0 4.148 0M8.367 5H5.235L4.13 8.536a1.898 1.898 0 1 0 3.695.801zm7.266 0 .542 4.337a1.898 1.898 0 1 0 3.695-.801L18.765 5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBusiness;
