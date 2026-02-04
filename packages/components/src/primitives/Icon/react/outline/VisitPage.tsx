import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgVisitPage = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M14.293 14.293a1 1 0 0 1 1-.25l6.5 2a1.002 1.002 0 0 1 .154 1.852l-2.702 1.35-1.35 2.702a1 1 0 0 1-1.851-.153l-2-6.5a1 1 0 0 1 .249-1.001m2.929 4.526.383-.766a1 1 0 0 1 .448-.448l.766-.383-2.308-.711.71 2.308Z"
      clipRule="evenodd"
    />
    <Path d="M19.5 3.5a2 2 0 0 1 2 2v6.25a1 1 0 1 1-2 0V5.5h-16v13h8a1 1 0 1 1 0 2h-8a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2z" />
    <Path d="M6.25 7a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5m3.5 0a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5m3.5 0a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5" />
  </Svg>
);
export default SvgVisitPage;
