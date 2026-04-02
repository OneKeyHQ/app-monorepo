import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBrainAi = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M10 2q.514.001 1 .1v11.435A4 4 0 0 0 9 13H8v2h1a2 2 0 0 1 2 2v4.793a5.5 5.5 0 0 1-6.64-3.334A4.5 4.5 0 0 1 2.757 12a4.5 4.5 0 0 1 2.597-6.853A5 5 0 0 1 10 2m4 0a5 5 0 0 1 4.645 3.147A4.5 4.5 0 0 1 21.242 12a4.5 4.5 0 0 1-1.602 6.459A5.5 5.5 0 0 1 13 21.793V10.465c.588.34 1.271.535 2 .535h1V9h-1a2 2 0 0 1-2-1.997V2.1a5 5 0 0 1 1-.101Z" />
  </Svg>
);
export default SvgBrainAi;
