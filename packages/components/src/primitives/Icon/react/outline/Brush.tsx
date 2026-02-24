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
      d="M18.5 6.086V7.5h1.414l3 3-9.415 9.415-1.084-1.086a2 2 0 0 0-2.83 0l-4.084 4.085L1.086 18.5l4.086-4.086a2 2 0 0 0-.001-2.829l-1.086-1.084L13.5 1.086zM6.895 10.52a4 4 0 0 1-.31 5.31l-2.67 2.67L5.5 20.084l2.672-2.67a4 4 0 0 1 5.308-.31l1.605-1.605-6.586-6.586zM9.913 7.5l6.586 6.586 3.587-3.585-1-1H16.5V6.914l-3-3z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBrush;
