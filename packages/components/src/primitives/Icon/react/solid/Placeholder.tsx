import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgPlaceholder = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M6 5a1 1 0 0 0-1 1 1 1 0 0 1-2 0 3 3 0 0 1 3-3 1 1 0 0 1 0 2Zm3.5-1a1 1 0 0 1 1-1h3a1 1 0 1 1 0 2h-3a1 1 0 0 1-1-1ZM17 4a1 1 0 0 1 1-1 3 3 0 0 1 3 3 1 1 0 1 1-2 0 1 1 0 0 0-1-1 1 1 0 0 1-1-1ZM4 9.5a1 1 0 0 1 1 1v3a1 1 0 1 1-2 0v-3a1 1 0 0 1 1-1Zm16 0a1 1 0 0 1 1 1v3a1 1 0 1 1-2 0v-3a1 1 0 0 1 1-1ZM4 17a1 1 0 0 1 1 1 1 1 0 0 0 1 1 1 1 0 1 1 0 2 3 3 0 0 1-3-3 1 1 0 0 1 1-1Zm16 0a1 1 0 0 1 1 1 3 3 0 0 1-3 3 1 1 0 1 1 0-2 1 1 0 0 0 1-1 1 1 0 0 1 1-1ZM9.5 20a1 1 0 0 1 1-1h3a1 1 0 1 1 0 2h-3a1 1 0 0 1-1-1Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPlaceholder;
