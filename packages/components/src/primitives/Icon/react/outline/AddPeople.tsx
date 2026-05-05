import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAddPeople = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M19 17h3v2h-3v3h-2v-3h-3v-2h3v-3h2zm-7-5a8.7 8.7 0 0 1 3.388.666l-.776 1.844A6.7 6.7 0 0 0 12 14c-3.23 0-5.611 2.091-6.32 5H12v2H3.401l.103-1.094C3.916 15.521 7.242 12 12 12" />
    <Path
      fillRule="evenodd"
      d="M12 2a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9m0 2a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgAddPeople;
