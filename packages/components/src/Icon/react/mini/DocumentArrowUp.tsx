import Svg, { Path } from 'react-native-svg';

import type { SvgProps } from 'react-native-svg';

const SvgDocumentArrowUp = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 20 20"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M4.5 2A1.5 1.5 0 0 0 3 3.5v13A1.5 1.5 0 0 0 4.5 18h11a1.5 1.5 0 0 0 1.5-1.5V7.621a1.5 1.5 0 0 0-.44-1.06l-4.12-4.122A1.5 1.5 0 0 0 11.378 2H4.5zm4.75 11.25a.75.75 0 0 0 1.5 0v-2.546l.943 1.048a.75.75 0 1 0 1.114-1.004l-2.25-2.5a.75.75 0 0 0-1.114 0l-2.25 2.5a.75.75 0 1 0 1.114 1.004l.943-1.048v2.546z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgDocumentArrowUp;
