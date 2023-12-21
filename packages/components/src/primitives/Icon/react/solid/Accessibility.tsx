import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgAccessibility = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M22 12c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2s10 4.477 10 10Zm-8.5-4a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0ZM9.154 9.762 9.14 9.76h-.004a1 1 0 1 0-.271 1.98l.006.002.016.002c.69.092 1.383.166 2.076.215a5.21 5.21 0 0 1-.32 1.404c-.254.649-.669 1.264-1.342 1.922a1 1 0 0 0 1.398 1.43 8.155 8.155 0 0 0 1.342-1.673c.316.561.72 1.106 1.234 1.647a1 1 0 0 0 1.45-1.378c-.977-1.028-1.43-2.037-1.626-3.357a33.835 33.835 0 0 0 2.014-.21l.017-.002.006-.001a1 1 0 1 0-.273-1.981h-.003l-.014.002C13.904 9.887 12.95 10 12 10c-.953 0-1.902-.113-2.846-.238Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgAccessibility;
