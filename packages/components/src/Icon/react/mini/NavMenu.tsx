import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgNavMenu = (props: SvgProps) => (
  <Svg
    viewBox="0 0 24 24"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M20.492 17.04H3.508c-.832 0-1.508.664-1.508 1.481 0 .817.676 1.482 1.508 1.482h16.984c.832 0 1.508-.665 1.508-1.482s-.676-1.481-1.508-1.481ZM20.492 10.52H3.508C2.676 10.52 2 11.183 2 12s.676 1.482 1.508 1.482h16.984c.832 0 1.508-.665 1.508-1.481 0-.818-.676-1.481-1.508-1.481ZM22 5.48C22 4.664 21.325 4 20.493 4H3.508C2.676 4 2 4.664 2 5.48c0 .818.676 1.482 1.508 1.482h16.985c.832 0 1.507-.664 1.507-1.482Z" />
  </Svg>
);
export default SvgNavMenu;
