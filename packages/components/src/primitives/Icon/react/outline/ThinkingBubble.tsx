import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgThinkingBubble = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M5 16a3 3 0 1 1 0 6 3 3 0 0 1 0-6m0 2a1 1 0 1 0 0 2 1 1 0 0 0 0-2m8-16c1.493 0 2.792.818 3.48 2.03a5 5 0 0 1 2.911 9.361 4.997 4.997 0 0 1-6.352 2.207A4 4 0 0 1 6 13a5 5 0 0 1 3.52-8.97A4 4 0 0 1 13 2m0 2a2 2 0 0 0-1.92 1.438l-.28.96-.96-.279a3 3 0 0 0-2.307 5.5l.615.344-.119.695a2 2 0 0 0 3.78 1.196l.506-1.069.97.677a3 3 0 0 0 4.45-1.227l.156-.344.343-.156A3.001 3.001 0 0 0 16.16 6.12l-.96.28-.28-.96A2 2 0 0 0 13 4"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgThinkingBubble;
