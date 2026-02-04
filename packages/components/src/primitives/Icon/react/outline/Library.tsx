import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgLibrary = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M11.773 2.998a2 2 0 0 1 2 2V6.95a2 2 0 0 1 1.092-.746l1.932-.518a2 2 0 0 1 2.387 1.22l.063.194 2.911 10.867a2 2 0 0 1-1.414 2.45l-1.931.517a2 2 0 0 1-2.45-1.414l-2.59-9.665v9.143a2 2 0 0 1-2 2h-4c-.364 0-.705-.1-1-.27-.294.17-.635.27-1 .27h-2a2 2 0 0 1-2-2v-12a2 2 0 0 1 2-2h2a2 2 0 0 1 2-2zm3.61 5.137 2.912 10.867 1.932-.517-2.913-10.867zM3.773 18.998h2v-12h-2zm4-2v2h4v-2zm0-2h4v-6h-4zm0-8h4v-2h-4z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgLibrary;
