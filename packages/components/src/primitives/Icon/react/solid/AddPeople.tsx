import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAddPeople = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M19.001 17h3v2h-3v3h-2v-3h-3v-2h3v-3h2zm-7-5c.786 0 1.54.097 2.251.282l.749.195V15h-3v6H3.402l.103-1.094C3.917 15.521 7.243 12 12 12Zm0-10a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9" />
  </Svg>
);
export default SvgAddPeople;
