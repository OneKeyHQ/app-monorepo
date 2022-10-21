import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgPrinter = (props: SvgProps) => (
  <Svg
    viewBox="0 0 20 20"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M5 4v3H4a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h1v2a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-2h1a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-1V4a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPrinter;
