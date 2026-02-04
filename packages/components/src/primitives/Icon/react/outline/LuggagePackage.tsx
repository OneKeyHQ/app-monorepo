import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgLuggagePackage = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M9 9a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0v-6a1 1 0 0 1 1-1m6 0a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0v-6a1 1 0 0 1 1-1" />
    <Path
      fillRule="evenodd"
      d="M14 2a2 2 0 0 1 2 2v1h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-1a1 1 0 1 1-2 0H8a1 1 0 1 1-2 0H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h3V4a2 2 0 0 1 2-2zm1.41 4.911A1 1 0 0 1 15 7H9a1 1 0 0 1-.411-.089A2 2 0 0 1 8 7H5v12h14V7h-3q-.309-.001-.59-.089M10 5h4V4h-4z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgLuggagePackage;
