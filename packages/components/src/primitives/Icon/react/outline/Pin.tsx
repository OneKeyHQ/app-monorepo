import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPin = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M11.998 6.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7m0 2a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3"
      clipRule="evenodd"
    />
    <Path
      fillRule="evenodd"
      d="M12 2a8 8 0 0 1 8 8c0 3.305-1.953 6.29-3.745 8.355a26 26 0 0 1-3.333 3.197q-.152.12-.237.184l-.067.05-.018.014-.005.004-.002.002c-.003-.004-.042-.055-.593-.806l.592.807-.592.433-.592-.433-.003-.003-.005-.004-.018-.014-.067-.05a24 24 0 0 1-1.066-.877 26 26 0 0 1-2.504-2.503C5.953 16.29 4 13.305 4 10a8 8 0 0 1 8-8m0 2a6 6 0 0 0-6 6c0 2.56 1.547 5.076 3.255 7.044A24 24 0 0 0 12 19.723a24 24 0 0 0 2.745-2.679C16.453 15.076 18 12.56 18 10a6 6 0 0 0-6-6"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPin;
