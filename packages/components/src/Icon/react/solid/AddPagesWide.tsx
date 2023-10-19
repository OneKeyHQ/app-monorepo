import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgAddPagesWide = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M5 4a3 3 0 0 0-3 3v6a3 3 0 0 0 3 3h1v1a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-6a3 3 0 0 0-3-3h-1V7a3 3 0 0 0-3-3H5Zm1 10v-3a3 3 0 0 1 3-3h7V7a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h1Zm6 1a1 1 0 1 1 0-2h1v-1a1 1 0 1 1 2 0v1h1a1 1 0 1 1 0 2h-1v1a1 1 0 1 1-2 0v-1h-1Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgAddPagesWide;
