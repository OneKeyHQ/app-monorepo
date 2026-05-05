import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAddedPeople = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m21.372 14.657-4.085 6.808L13.6 18.7l1.2-1.6 1.912 1.434 2.945-4.906zM12 12a8.7 8.7 0 0 1 3.388.666l.922.389-.777 1.843-.92-.388A6.7 6.7 0 0 0 12 14c-3.23 0-5.611 2.091-6.32 5H12v2H3.401l.103-1.094C3.916 15.521 7.242 12 12 12" />
    <Path
      fillRule="evenodd"
      d="M12 2a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9m0 2a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgAddedPeople;
