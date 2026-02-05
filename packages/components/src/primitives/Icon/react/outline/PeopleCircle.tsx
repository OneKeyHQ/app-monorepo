import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPeopleCircle = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M20 12a8 8 0 1 0-13.932 5.365C7.563 15.895 9.613 15 12 15s4.437.896 5.93 2.365A7.97 7.97 0 0 0 20 12m-8 5c-1.79 0-3.296.637-4.41 1.675A7.96 7.96 0 0 0 12 20c1.63 0 3.145-.488 4.41-1.325C15.295 17.637 13.79 17 12 17m2-7a2 2 0 1 0-4 0 2 2 0 0 0 4 0m8 2a9.98 9.98 0 0 1-3.462 7.566A9.97 9.97 0 0 1 12 22a9.97 9.97 0 0 1-6.538-2.434A9.98 9.98 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10m-6-2a4 4 0 1 1-8 0 4 4 0 0 1 8 0" />
  </Svg>
);
export default SvgPeopleCircle;
