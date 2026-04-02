import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAnchor = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12 2a3.5 3.5 0 0 1 1 6.854V19.98A7.5 7.5 0 0 0 19.981 13H17v-2h5v1.5a9.5 9.5 0 0 1-9.5 9.5h-1A9.5 9.5 0 0 1 2 12.5V11h5v2H4.019A7.5 7.5 0 0 0 11 19.981V8.854A3.5 3.5 0 0 1 12 2m0 2a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgAnchor;
