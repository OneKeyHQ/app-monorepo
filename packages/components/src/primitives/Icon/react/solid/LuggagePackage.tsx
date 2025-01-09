import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgLuggagePackage = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M11 4a1 1 0 0 0-1 1h4a1 1 0 0 0-1-1h-2Zm5 1a3 3 0 0 0-3-3h-2a3 3 0 0 0-3 3H6a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3 1 1 0 1 0 2 0h8a1 1 0 1 0 2 0 3 3 0 0 0 3-3V8a3 3 0 0 0-3-3h-2ZM9 9a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0v-6a1 1 0 0 1 1-1Zm6 0a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0v-6a1 1 0 0 1 1-1Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgLuggagePackage;
