import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAnimation = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M5 3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm10.95 4c-1.38 0-2.374.729-3.104 1.614-.692.839-1.234 1.924-1.712 2.882l-.029.057c-.513 1.028-.962 1.916-1.494 2.56-.507.616-.988.887-1.56.887H8a1 1 0 1 0 0 2h.05c1.379 0 2.373-.729 3.103-1.614.692-.838 1.234-1.924 1.712-2.882l.029-.057c.513-1.028.962-1.916 1.494-2.56.507-.615.988-.887 1.561-.887H16a1 1 0 1 0 0-2z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgAnimation;
