import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgProducthunt = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path fill="currentColor" d="M10.5 12h2.833a1.5 1.5 0 0 0 0-3H10.5v3Z" />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M22 12c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2s10 4.477 10 10ZM8.5 7h4.833a3.5 3.5 0 0 1 0 7H10.5v3h-2V7Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgProducthunt;
