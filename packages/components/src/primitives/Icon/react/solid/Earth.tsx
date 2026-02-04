import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgEarth = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M22 12c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2s10 4.477 10 10m-7.307 5a.5.5 0 0 0 .447-.276l.665-1.33a.5.5 0 0 0-.168-.64l-2.47-1.66a.5.5 0 0 0-.248-.084l-1.583-.1a.5.5 0 0 0-.385.144l-.658.656a.5.5 0 0 0-.063.632l1.623 2.435a.5.5 0 0 0 .417.223zM8.27 10.465a.5.5 0 0 1-.748.174L5.098 8.811a.48.48 0 0 1-.14-.61 8 8 0 0 1 8.498-4.069c.271.05.434.323.367.592l-.749 2.986a.5.5 0 0 1-.363.363l-3.483.876a.5.5 0 0 0-.325.26l-.632 1.256Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgEarth;
