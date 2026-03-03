import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChecklistBox = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M21 21H3V3h18zM8.436 14.893l-1.17-.78-1.11 1.663 2.744 1.83 3.04-4.052-1.6-1.2zM13 16h4v-2h-4zM8.436 8.89l-1.17-.779-1.11 1.664 2.744 1.83 3.04-4.053-1.6-1.2zM13.058 10h4V8h-4z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgChecklistBox;
