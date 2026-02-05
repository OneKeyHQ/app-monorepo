import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgThumbUp = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M11.615 2a3 3 0 0 1 2.965 3.462L14.184 8h3.88a4 4 0 0 1 3.962 4.54l-.681 5A4 4 0 0 1 17.38 21H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h2.382l3.723-7.447.072-.121A1 1 0 0 1 11 2zM8 11.236V19h9.38a2 2 0 0 0 1.983-1.73l.682-5A2 2 0 0 0 18.063 10h-5.046a1 1 0 0 1-.989-1.154l.575-3.692A1 1 0 0 0 11.617 4zM4 19h2v-7H4z" />
  </Svg>
);
export default SvgThumbUp;
