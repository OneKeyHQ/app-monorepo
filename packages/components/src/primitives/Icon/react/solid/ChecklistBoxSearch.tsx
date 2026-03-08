import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChecklistBoxSearch = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M14.172 14.172a4 4 0 0 1 6.274 4.86L22.414 21 21 22.414l-1.968-1.968a4.001 4.001 0 0 1-4.86-6.274m4.242 1.414a2 2 0 1 0-2.828 2.828 2 2 0 0 0 2.828-2.828"
      clipRule="evenodd"
    />
    <Path
      fillRule="evenodd"
      d="M21 3v9.527A6 6 0 0 0 12.527 21H3V3zM7.436 14.893l-1.17-.78-1.11 1.663 2.744 1.83 3.04-4.052-1.6-1.2zm0-6.002-1.17-.78-1.11 1.664 2.744 1.83 3.04-4.052-1.6-1.2zM13.058 8v2h4V8z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgChecklistBoxSearch;
