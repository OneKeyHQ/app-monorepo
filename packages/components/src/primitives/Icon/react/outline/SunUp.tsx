import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSunUp = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M11.293 1.293a1 1 0 0 1 1.414 0l3 3a1 1 0 0 1-1.414 1.414L13 4.414V8a1 1 0 1 1-2 0V4.414L9.707 5.707a1 1 0 0 1-1.414-1.414zm-6.954 8.28a1 1 0 0 1 1.41-.124l.765.643a1 1 0 1 1-1.285 1.532l-.766-.643a1 1 0 0 1-.124-1.409Zm15.322 0a1 1 0 0 1-.123 1.408l-.766.643a1 1 0 0 1-1.286-1.532l.766-.643a1 1 0 0 1 1.409.123ZM12 13a3 3 0 0 0-3 3 1 1 0 1 1-2 0 5 5 0 0 1 10 0 1 1 0 1 1-2 0 3 3 0 0 0-3-3M2 16a1 1 0 0 1 1-1h1a1 1 0 1 1 0 2H3a1 1 0 0 1-1-1m17 0a1 1 0 0 1 1-1h1a1 1 0 1 1 0 2h-1a1 1 0 0 1-1-1M2 20a1 1 0 0 1 1-1h18a1 1 0 1 1 0 2H3a1 1 0 0 1-1-1"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgSunUp;
