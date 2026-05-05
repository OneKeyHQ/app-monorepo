import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPeopleShadow = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M7.5 12c3.47 0 6.64 2.857 6.997 7.93l.076 1.07H.427l.076-1.07C.86 14.857 4.029 12 7.5 12m0 2c-2.006 0-4.262 1.505-4.872 5h9.744c-.61-3.495-2.866-5-4.872-5"
      clipRule="evenodd"
    />
    <Path d="M13.849 12.595c2.005-.942 4.333-.763 6.208.52 1.881 1.286 3.214 3.613 3.44 6.815l.075 1.07H17v-2h4.371c-.369-2.1-1.335-3.478-2.442-4.235-1.293-.884-2.869-.999-4.23-.36z" />
    <Path
      fillRule="evenodd"
      d="M7.5 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8m0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4m9-2a4 4 0 1 1 0 8 4 4 0 0 1 0-8m0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPeopleShadow;
