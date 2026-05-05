import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBroom = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m21.364 2.625-5.152 9.068.263.096c1.52.554 2.737 2.063 2.484 3.864-.336 2.393-1.359 4.12-3.245 6.047l-.476.486-6.468-2.724L10 17l-3.234 1.618L3.398 17.2l1.548-1.032c1.457-.971 2.623-1.923 3.498-3.3 1.057-1.662 3.154-2.854 5.28-2.08l.582.212 5.319-9.363zM6.667 7.333 9 8.5 6.667 9.667 5.5 12 4.333 9.667 2 8.5l2.333-1.167L5.5 5zm4.666-3.666L13 4.5l-1.667.833L10.5 7l-.833-1.667L8 4.5l1.667-.833L10.5 2z" />
  </Svg>
);
export default SvgBroom;
