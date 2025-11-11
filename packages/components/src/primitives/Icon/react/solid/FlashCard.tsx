import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFlashCard = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 20 20" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M7.708 2.687a3 3 0 0 1 3.297-2.67l5.968.627a3 3 0 0 1 2.67 3.296v.001l-.94 8.95a3 3 0 0 1-3.299 2.67l-2.549-.268.037.344a3 3 0 0 1-2.67 3.297l-5.967.627a3 3 0 0 1-3.298-2.67l-.94-8.95a3 3 0 0 1 2.67-3.298l4.869-.512zm1.154 3.318-5.966.627a1 1 0 0 0-.89 1.099l.94 8.95a1 1 0 0 0 1.1.89l5.967-.627a1 1 0 0 0 .89-1.098l-.941-8.951a1 1 0 0 0-1.1-.89m1.934-4a1 1 0 0 0-1.099.89l-.123 1.167a3 3 0 0 1 2.377 2.624l.69 6.574 2.972.312a1 1 0 0 0 1.1-.89l.94-8.95a1 1 0 0 0-.89-1.1z"
    />
  </Svg>
);
export default SvgFlashCard;
