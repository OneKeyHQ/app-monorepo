import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBook = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M7 2a3 3 0 0 0-3 3v14a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V5a3 3 0 0 0-3-3H7ZM6 19a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-1.17c-.313.11-.65.17-1 .17H7a1 1 0 0 0-1 1ZM9 6a1 1 0 0 0 0 2h6a1 1 0 1 0 0-2H9Zm-1 5a1 1 0 0 1 1-1h3a1 1 0 1 1 0 2H9a1 1 0 0 1-1-1Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBook;
