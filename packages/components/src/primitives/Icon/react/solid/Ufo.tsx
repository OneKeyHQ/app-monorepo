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
      d="M12 2a5 5 0 0 1 4.97 4.443c.889.17 1.707.385 2.431.638.966.338 1.82.764 2.45 1.286C22.477 8.884 23 9.6 23 10.5c0 1.321-1.099 2.24-2.203 2.821-.854.45-1.928.817-3.143 1.093l3.726 5.897-1.691 1.069-6.301-9.977a8.5 8.5 0 0 0-2.776 0l-6.3 9.977-1.692-1.07 3.726-5.897c-1.215-.276-2.29-.644-3.143-1.093C2.098 12.741 1 11.821 1 10.5c0-.9.524-1.616 1.148-2.133.632-.522 1.485-.948 2.45-1.286a17 17 0 0 1 2.432-.638A5 5 0 0 1 12 2m0 2a3 3 0 0 0-2.875 2.142A29 29 0 0 1 12 6c.992 0 1.957.049 2.875.142A3 3 0 0 0 12 4"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgUfo;
