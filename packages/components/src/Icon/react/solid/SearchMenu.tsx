import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgSearchMenu = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M15.004 5a7 7 0 1 0 4.19 12.608l2.099 2.1a1 1 0 0 0 1.414-1.415l-2.098-2.099A7 7 0 0 0 15.004 5ZM15 9a3 3 0 0 0-3 3 1 1 0 1 1-2 0 5 5 0 0 1 5-5 1 1 0 1 1 0 2Z"
      clipRule="evenodd"
    />
    <Path
      fill="currentColor"
      d="M2.004 7a1 1 0 0 1 1-1h3a1 1 0 0 1 0 2h-3a1 1 0 0 1-1-1Zm0 5a1 1 0 0 1 1-1h2a1 1 0 1 1 0 2h-2a1 1 0 0 1-1-1Zm1 4a1 1 0 1 0 0 2h3a1 1 0 1 0 0-2h-3Z"
    />
  </Svg>
);
export default SvgSearchMenu;
