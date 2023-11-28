import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBook = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M9 6a1 1 0 0 0 0 2V6Zm6 2a1 1 0 1 0 0-2v2Zm-6 2a1 1 0 1 0 0 2v-2Zm3 2a1 1 0 1 0 0-2v2ZM7 4h10V2H7v2Zm11 1v14h2V5h-2Zm-1 15H7v2h10v-2ZM6 19V5H4v14h2Zm1 1a1 1 0 0 1-1-1H4a3 3 0 0 0 3 3v-2Zm11-1a1 1 0 0 1-1 1v2a3 3 0 0 0 3-3h-2ZM17 4a1 1 0 0 1 1 1h2a3 3 0 0 0-3-3v2ZM7 2a3 3 0 0 0-3 3h2a1 1 0 0 1 1-1V2Zm11 10v3h2v-3h-2Zm-1 4H7v2h10v-2ZM7 22h3v-2H7v2Zm0-6a3 3 0 0 0-3 3h2a1 1 0 0 1 1-1v-2Zm11-1a1 1 0 0 1-1 1v2a3 3 0 0 0 3-3h-2ZM9 8h6V6H9v2Zm0 4h3v-2H9v2Z"
    />
  </Svg>
);
export default SvgBook;
