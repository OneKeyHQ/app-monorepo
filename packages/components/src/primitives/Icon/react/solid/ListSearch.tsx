import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgListSearch = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M4 3a1 1 0 0 0 0 2h13a1 1 0 1 0 0-2H4Zm0 5a1 1 0 0 0 0 2h5a1 1 0 0 0 0-2H4Zm0 6a1 1 0 1 0 0 2h5a1 1 0 1 0 0-2H4Zm0 5a1 1 0 1 0 0 2h13a1 1 0 1 0 0-2H4Z"
    />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M16 8a4 4 0 1 0 2.032 7.446l.989.99a1 1 0 1 0 1.414-1.415l-.989-.99A4 4 0 0 0 16 8Zm-2 4a2 2 0 1 1 4 0 2 2 0 0 1-4 0Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgListSearch;
