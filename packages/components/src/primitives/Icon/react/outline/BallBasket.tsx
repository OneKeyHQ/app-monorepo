import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBallBasket = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="square"
      strokeWidth={2}
      d="M21 12h-9m9 0a8.97 8.97 0 0 1-2.5 6.225M21 12a8.97 8.97 0 0 0-2.5-6.225M12 21v-9m0 9a8.974 8.974 0 0 1-6.5-2.775M12 21a8.974 8.974 0 0 0 6.5-2.775M3 12h9m-9 0a8.97 8.97 0 0 1 2.5-6.225M3 12a8.97 8.97 0 0 0 2.5 6.225M12 3v9m0-9a8.974 8.974 0 0 0-6.5 2.775M12 3a8.974 8.974 0 0 1 6.5 2.775m-13 0A8.97 8.97 0 0 1 8 12a8.97 8.97 0 0 1-2.5 6.225m13 0A8.97 8.97 0 0 1 16 12a8.97 8.97 0 0 1 2.5-6.225"
    />
  </Svg>
);
export default SvgBallBasket;
