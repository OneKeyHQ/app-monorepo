import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgLoader = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M13 22h-2v-5h2zm-3.828-5.758-3.536 3.536-1.415-1.414 3.537-3.536zm10.606 2.122-1.414 1.414-3.535-3.536 1.414-1.414zM7 13.001H2v-2h5zm15 0h-5v-2h5zM9.172 7.758 7.758 9.172 4.22 5.636l1.415-1.414 3.536 3.536Zm10.606-2.122-3.535 3.536-1.414-1.414 3.535-3.536zM13 7h-2V2h2z" />
  </Svg>
);
export default SvgLoader;
