import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgLogoCircular = (props: SvgProps) => (
  <Svg viewBox="0 0 32 32" fill="none" accessibilityRole="image" {...props}>
    <Path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M16 0C7.163 0 0 7.163 0 16s7.163 16 16 16 16-7.163 16-16S24.837 0 16 0Zm-3.005 6.785h4.45v7.335h-2.759V9.146h-2.472l.78-2.361ZM16 25.215a5.076 5.076 0 1 0 0-10.152 5.076 5.076 0 0 0 0 10.152Zm0-2.304a2.772 2.772 0 1 0 0-5.544 2.772 2.772 0 0 0 0 5.544Z"
      fill="currentColor"
    />
  </Svg>
);
export default SvgLogoCircular;
