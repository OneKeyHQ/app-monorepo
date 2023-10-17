import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgPlusCircle = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10S2 17.523 2 12Zm14 1a1 1 0 1 0 0-2h-3V8a1 1 0 1 0-2 0v3H8a1 1 0 0 0 0 2h3v3a1 1 0 1 0 2 0v-3h3Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPlusCircle;
