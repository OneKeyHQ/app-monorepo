import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBrandLogo = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 27 27" accessibilityRole="image" {...props}>
    <Path
      fill="#44D62C"
      d="M27 13.5C27 22.82 22.82 27 13.5 27S0 22.82 0 13.5 4.18 0 13.5 0 27 4.18 27 13.5"
    />
    <Path fill="#000" d="M14.72 5.725h-3.756l-.659 1.992h2.086v4.197h2.329z" />
    <Path
      fill="#000"
      fillRule="evenodd"
      d="M17.783 16.993a4.283 4.283 0 1 1-8.566 0 4.283 4.283 0 0 1 8.566 0m-1.944 0a2.339 2.339 0 1 1-4.678 0 2.339 2.339 0 0 1 4.678 0"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBrandLogo;
