import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCoinsAdd = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M6 14a9.001 9.001 0 0 1 7.959-8.94 7 7 0 1 0-7.613 11.42A9.006 9.006 0 0 1 6 14Z" />
    <Path
      fillRule="evenodd"
      d="M15 21a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm1-9a1 1 0 1 0-2 0v1h-1a1 1 0 1 0 0 2h1v1a1 1 0 1 0 2 0v-1h1a1 1 0 1 0 0-2h-1v-1Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCoinsAdd;
