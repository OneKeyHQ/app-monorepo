import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPackageAddress = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M14.793 13.171a4 4 0 0 1 5.657 5.658l-2.121 2.12a1 1 0 0 1-1.415 0l-2.122-2.12a4 4 0 0 1 0-5.658Zm4.243 1.414a2 2 0 0 0-2.83 2.83l1.415 1.413 1.415-1.413a2 2 0 0 0 0-2.83m-5.658-9.828h-4v3h4zm5 4v-4h-3v3a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-3h-3v14h7a1 1 0 1 1 0 2h-7a2 2 0 0 1-2-2v-14a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a1 1 0 1 1-2 0" />
  </Svg>
);
export default SvgPackageAddress;
