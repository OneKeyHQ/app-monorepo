import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgShieldQuestion = (props: SvgProps) => (
  <Svg viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M12.975 2.278a3 3 0 0 0-1.95 0l-6 2.063A3 3 0 0 0 3 7.178v4.735c0 2.806 1.149 4.83 2.813 6.404 1.572 1.489 3.632 2.6 5.555 3.637l.157.084a1 1 0 0 0 .95 0l.157-.084c1.923-1.037 3.983-2.148 5.556-3.637C19.85 16.742 21 14.72 21 11.913V7.178a3 3 0 0 0-2.025-2.837zm-.851 4.385c-1.39 0-2.5 1.135-2.5 2.515a1 1 0 0 0 2 0c0-.294.232-.515.5-.515a.507.507 0 0 1 .489.6.2.2 0 0 1-.027.048 1.1 1.1 0 0 1-.267.226c-.508.345-1.128.923-1.286 1.978a1 1 0 1 0 1.978.297.76.76 0 0 1 .139-.359 1.2 1.2 0 0 1 .294-.262c.436-.297 1.18-.885 1.18-2.013 0-1.38-1.11-2.515-2.5-2.515M12 15.75a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgShieldQuestion;
