import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgTranslate = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M15.156 11.3c.687-1.631 3-1.631 3.688 0l3.078 7.312a1 1 0 0 1-1.844.777L19.493 18h-4.986l-.585 1.389a1 1 0 0 1-1.844-.777zm.193 4.7h3.302L17 12.077zM8 3a1 1 0 0 1 1 1v1h3a1 1 0 1 1 0 2h-.629c-.312 1.911-.928 3.523-1.934 4.817.75.526 1.673.93 2.805 1.213a1 1 0 1 1-.485 1.94c-1.461-.365-2.717-.929-3.758-1.727-1.041.798-2.296 1.361-3.757 1.727a1 1 0 1 1-.484-1.94c1.131-.284 2.054-.688 2.805-1.213C5.557 10.523 4.94 8.911 4.629 7H4a1 1 0 0 1 0-2h3V4a1 1 0 0 1 1-1M6.658 7c.266 1.413.716 2.525 1.342 3.4.626-.875 1.076-1.986 1.342-3.4z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgTranslate;
