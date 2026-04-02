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
      d="M12 2a8 8 0 0 1 8 8c0 3.305-1.953 6.29-3.745 8.355a26 26 0 0 1-3.333 3.197q-.152.12-.237.184l-.067.05-.018.014-.005.005h-.002L12 22.24l-.592-.434-.003-.001-.005-.005-.018-.014-.067-.05a23 23 0 0 1-1.066-.877 26 26 0 0 1-2.504-2.503C5.953 16.29 4 13.305 4 10a8 8 0 0 1 8-8m-.002 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPin;
