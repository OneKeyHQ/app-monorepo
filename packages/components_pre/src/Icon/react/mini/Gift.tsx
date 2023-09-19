import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgGift = (props: SvgProps) => (
  <Svg
    viewBox="0 0 20 20"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M14 6a2.5 2.5 0 0 0-4-3 2.5 2.5 0 0 0-4 3H3.25C2.56 6 2 6.56 2 7.25v.5C2 8.44 2.56 9 3.25 9h6V6h1.5v3h6C17.44 9 18 8.44 18 7.75v-.5C18 6.56 17.44 6 16.75 6H14zm-1-1.5a1 1 0 0 1-1 1h-1v-1a1 1 0 1 1 2 0zm-6 0a1 1 0 0 0 1 1h1v-1a1 1 0 0 0-2 0z"
      clipRule="evenodd"
    />
    <Path d="M9.25 10.5H3v4.75A2.75 2.75 0 0 0 5.75 18h3.5v-7.5zm1.5 7.5v-7.5H17v4.75A2.75 2.75 0 0 1 14.25 18h-3.5z" />
  </Svg>
);
export default SvgGift;
