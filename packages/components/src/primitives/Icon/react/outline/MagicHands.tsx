import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMagicHands = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M3.756 11.528a3.25 3.25 0 0 1 4.069 1.71l.481-.173.94-.342.683 1.879a4 4 0 0 1-7.517 2.736l-.599-1.645a3.25 3.25 0 0 1 1.943-4.165m2.286 2.626a1.25 1.25 0 1 0-2.349.856l.599 1.644a2 2 0 0 0 3.818-1.173l-.06-.195-1.41.513zm10.132-.916a3.25 3.25 0 0 1 6.012 2.455l-.598 1.645a4 4 0 0 1-7.518-2.736l.685-1.88.939.343zm3.385.17a1.25 1.25 0 0 0-1.601.746l-.599 1.645-1.41-.513a2 2 0 0 0 3.76 1.368l.597-1.644a1.25 1.25 0 0 0-.747-1.603Z"
      clipRule="evenodd"
    />
    <Path d="M12 6a6 6 0 0 1 5.572 3.77l-1.857.745a4.002 4.002 0 0 0-7.43 0L6.427 9.77A6 6 0 0 1 12 6" />
    <Path d="M12 3a9 9 0 0 1 8.358 5.656l-1.856.743a7.003 7.003 0 0 0-13.003 0L3.64 8.656A9 9 0 0 1 12 3" />
  </Svg>
);
export default SvgMagicHands;
