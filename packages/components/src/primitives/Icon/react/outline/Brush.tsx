import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBrush = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12.086 2.5a2 2 0 0 1 2.676-.137l.153.137 3.293 3.293c.187.188.292.442.292.707v1h1l.1.005c.228.023.444.124.608.288L21.5 9.086a2 2 0 0 1 0 2.827v.001l-6.667 6.668a1.885 1.885 0 0 1-2.665 0 1.65 1.65 0 0 0-2.334 0l-2.92 2.917a2 2 0 0 1-2.827.001L2.5 19.914a2 2 0 0 1 0-2.828l2.919-2.92a1.65 1.65 0 0 0-.001-2.334 1.884 1.884 0 0 1-.001-2.664zm-5.173 8.001a3.65 3.65 0 0 1-.08 5.08l-2.918 2.92L5.5 20.084l2.919-2.918a3.65 3.65 0 0 1 5.079-.08l1.587-1.588L8.5 8.913zm3-3.002 6.587 6.586 3.586-3.585-1-1H17.5a1 1 0 0 1-1-1V6.914l-3-3L9.914 7.5Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBrush;
