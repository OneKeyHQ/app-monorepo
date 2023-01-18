import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgEmojiSad = (props: SvgProps) => (
  <Svg
    viewBox="0 0 20 20"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM7 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm7-1a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-7.536 5.879a1 1 0 0 0 1.415 0 3 3 0 0 1 4.242 0 1 1 0 0 0 1.415-1.415 5 5 0 0 0-7.072 0 1 1 0 0 0 0 1.415z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgEmojiSad;
