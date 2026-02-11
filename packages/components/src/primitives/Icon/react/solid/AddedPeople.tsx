import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAddedPeople = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M7.614 6.542a4.462 4.462 0 1 1 8.924 0 4.462 4.462 0 0 1-8.924 0m8.509 9.123 1.155-1.925c-1.39-1.092-3.163-1.744-5.202-1.744-4.718 0-8.015 3.491-8.424 7.84a.99.99 0 0 0 .987 1.084h8.76l-.133-.1a2.975 2.975 0 0 1 2.857-5.155" />
    <Path d="M20.859 15.48a.992.992 0 0 0-1.7-1.02l-2.41 4.015-1.103-.827a.992.992 0 1 0-1.19 1.586l1.983 1.488a.99.99 0 0 0 1.445-.284l2.975-4.957Z" />
  </Svg>
);
export default SvgAddedPeople;
