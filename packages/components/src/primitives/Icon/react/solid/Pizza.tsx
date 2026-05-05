import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPizza = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M5.198 5.523c1.08 6.816 6.464 12.2 13.28 13.279l-.578 3.366-.997-.185a18.53 18.53 0 0 1-9.75-5.136 18.53 18.53 0 0 1-5.136-9.75L1.832 6.1z" />
    <Path d="M16 13a2 2 0 0 1 1.41 3.42l-.093.09A14 14 0 0 1 14 15.128V15a2 2 0 0 1 2-2" />
    <Path d="M19.47 13.009a4.002 4.002 0 0 0-7.306.852A14 14 0 0 1 7.17 5.185l4.259-.73a3 3 0 1 0 4.482-.769l5.314-.91-1.754 10.233Z" />
    <Path d="M14 5a1 1 0 1 1 0 2 1 1 0 0 1 0-2" />
  </Svg>
);
export default SvgPizza;
