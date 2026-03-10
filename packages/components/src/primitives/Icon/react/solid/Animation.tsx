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
      d="M21 3v18H3V3zm-5.05 4c-1.38 0-2.374.73-3.104 1.614-.692.839-1.234 1.924-1.712 2.882l-.029.058c-.513 1.028-.962 1.916-1.494 2.56-.507.615-.988.886-1.561.886H7v2h1.05c1.38 0 2.374-.728 3.104-1.613.692-.839 1.234-1.925 1.712-2.883l.029-.057c.513-1.028.962-1.915 1.494-2.56.507-.615.988-.887 1.561-.887H17V7z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgAnimation;
