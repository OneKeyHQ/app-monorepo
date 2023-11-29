import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgTextIndicator = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M16 3a1 1 0 0 1 1-1h4a1 1 0 1 1 0 2h-1v16h1a1 1 0 1 1 0 2h-4a1 1 0 1 1 0-2h1V4h-1a1 1 0 0 1-1-1ZM2 6a1 1 0 0 1 1-1h10a1 1 0 1 1 0 2H9v11a1 1 0 1 1-2 0V7H3a1 1 0 0 1-1-1Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgTextIndicator;
