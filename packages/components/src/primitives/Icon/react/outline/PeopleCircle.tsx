import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPeopleCircle = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12 6a4 4 0 1 1 0 8 4 4 0 0 1 0-8m0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4"
      clipRule="evenodd"
    />
    <Path
      fillRule="evenodd"
      d="M12 2c5.523 0 10 4.477 10 10a9.98 9.98 0 0 1-3.462 7.566A9.97 9.97 0 0 1 12 22a9.97 9.97 0 0 1-6.538-2.434A9.98 9.98 0 0 1 2 12C2 6.477 6.477 2 12 2m0 15c-1.794 0-3.298.639-4.41 1.675A7.96 7.96 0 0 0 12 20a7.96 7.96 0 0 0 4.41-1.324C15.297 17.64 13.793 17 12 17m0-13a8 8 0 0 0-8 8c0 2.064.783 3.943 2.067 5.362C7.564 15.891 9.617 15 12 15s4.436.89 5.933 2.362A7.97 7.97 0 0 0 20 12a8 8 0 0 0-8-8"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPeopleCircle;
