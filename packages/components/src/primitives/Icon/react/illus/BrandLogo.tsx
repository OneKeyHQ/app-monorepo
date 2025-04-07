import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBrandLogo = (props: SvgProps) => (
  <Svg viewBox="0 0 27 27" fill="none" accessibilityRole="image" {...props}>
    <Path
      d="M27 13.5C27 22.82 22.82 27 13.5 27S0 22.82 0 13.5 4.18 0 13.5 0 27 4.18 27 13.5Z"
      fill="#44D62C"
    />
    <Path
      d="M14.72 5.725h-3.756l-.659 1.992h2.086v4.197h2.329v-6.19Z"
      fill="#000"
    />
    <Path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M17.783 16.992a4.283 4.283 0 1 1-8.566 0 4.283 4.283 0 0 1 8.566 0Zm-1.944 0a2.339 2.339 0 1 1-4.678 0 2.339 2.339 0 0 1 4.678 0Z"
      fill="#000"
    />
  </Svg>
);
export default SvgBrandLogo;
