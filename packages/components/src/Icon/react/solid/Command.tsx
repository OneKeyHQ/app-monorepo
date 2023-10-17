import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCommand = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M3 6.5a3.5 3.5 0 1 1 7 0V8h4V6.5a3.5 3.5 0 1 1 3.5 3.5H16v4h1.5a3.5 3.5 0 1 1-3.5 3.5V16h-4v1.5A3.5 3.5 0 1 1 6.5 14H8v-4H6.5A3.5 3.5 0 0 1 3 6.5ZM8 8V6.5A1.5 1.5 0 1 0 6.5 8H8Zm2 2v4h4v-4h-4Zm-2 6H6.5A1.5 1.5 0 1 0 8 17.5V16Zm8 0v1.5a1.5 1.5 0 1 0 1.5-1.5H16Zm0-8h1.5A1.5 1.5 0 1 0 16 6.5V8Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCommand;
