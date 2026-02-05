import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgUfo = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M7.03 6.443a17 17 0 0 0-2.431.638c-.966.338-1.82.764-2.45 1.286C1.523 8.884 1 9.6 1 10.5c0 1.321 1.098 2.24 2.203 2.821.854.45 1.928.817 3.142 1.093l-3.19 5.052a1 1 0 1 0 1.69 1.068l5.767-9.13a8.5 8.5 0 0 1 2.776 0l5.766 9.13a1 1 0 0 0 1.692-1.068l-3.191-5.052c1.214-.276 2.288-.644 3.142-1.093 1.105-.58 2.203-1.5 2.203-2.821 0-.9-.524-1.616-1.148-2.133-.631-.522-1.485-.948-2.45-1.286a17 17 0 0 0-2.433-.638 5 5 0 0 0-9.938 0Zm2.095-.301A29 29 0 0 1 12 6c.992 0 1.957.049 2.875.142a3.001 3.001 0 0 0-5.75 0"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgUfo;
