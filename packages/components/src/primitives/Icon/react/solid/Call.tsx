import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCall = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M5.072 3c-1.083 0-2.03.891-1.959 2.053.525 8.505 7.33 15.31 15.835 15.834C20.109 20.96 21 20.012 21 18.93v-3.043a1.99 1.99 0 0 0-1.418-1.907l-2.704-.81a1.99 1.99 0 0 0-1.98.498l-.745.746a12 12 0 0 1-4.566-4.565l.746-.746c.518-.518.71-1.278.5-1.98L10.02 4.42A1.99 1.99 0 0 0 8.114 3z" />
  </Svg>
);
export default SvgCall;
