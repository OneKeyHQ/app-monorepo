import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMagicBox = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M9 14a1 1 0 0 1 1-1h4a1 1 0 1 1 0 2h-4a1 1 0 0 1-1-1Z"
      clipRule="evenodd"
    />
    <Path
      fill="currentColor"
      d="M11.85 3.075a.5.5 0 0 0 .224-.224l.478-.957a.5.5 0 0 1 .894 0l.479.957a.5.5 0 0 0 .223.224l.957.478a.5.5 0 0 1 0 .894l-.957.478a.5.5 0 0 0-.223.224l-.479.957a.5.5 0 0 1-.894 0l-.478-.957a.5.5 0 0 0-.224-.224l-.956-.478a.5.5 0 0 1 0-.894l.956-.478ZM6.517 4.741a.5.5 0 0 0 .223-.223l.312-.624a.5.5 0 0 1 .894 0l.312.624a.5.5 0 0 0 .224.223l.623.312a.5.5 0 0 1 0 .894l-.623.312a.5.5 0 0 0-.224.223l-.312.624a.5.5 0 0 1-.894 0l-.312-.624a.5.5 0 0 0-.223-.223l-.623-.312a.5.5 0 0 1 0-.894l.623-.312Z"
    />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M19.524 4.148a1 1 0 0 1 .328 1.376L17.712 9H19a1 1 0 0 1 1 1v9a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-9a1 1 0 0 1 1-1h10.364l2.784-4.524a1 1 0 0 1 1.376-.328ZM6 11v8a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-8H6Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMagicBox;
