import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgXBackspace = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M8.422 4a2 2 0 0 0-1.628.838l-4.285 6a2 2 0 0 0 0 2.325l4.285 6A2 2 0 0 0 8.422 20h11.485a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm2.026 5.293a1 1 0 0 1 1.415 0l1.294 1.295 1.295-1.295a1 1 0 1 1 1.414 1.414l-1.294 1.295 1.292 1.293a1 1 0 0 1-1.414 1.414l-1.293-1.293-1.293 1.293a1 1 0 0 1-1.414-1.414l1.293-1.293-1.295-1.295a1 1 0 0 1 0-1.414"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgXBackspace;
