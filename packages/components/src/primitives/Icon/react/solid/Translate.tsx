import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgTranslate = (props: SvgProps) => (
  <Svg viewBox="0 0 24 24" fill="none" accessibilityRole="image" {...props}>
    <Path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M8 3a1 1 0 0 1 1 1v1h3a1 1 0 0 1 0 2h-.627c-.313 1.912-.929 3.524-1.936 4.819.751.525 1.674.928 2.806 1.21a1 1 0 0 1-.485 1.941c-1.461-.365-2.717-.928-3.758-1.725-1.04.797-2.296 1.36-3.757 1.725a1 1 0 1 1-.485-1.94c1.131-.283 2.054-.686 2.805-1.211C5.556 10.524 4.94 8.912 4.628 7H4a1 1 0 0 1 0-2h3V4a1 1 0 0 1 1-1ZM6.658 7c.266 1.414.716 2.527 1.342 3.401C8.627 9.527 9.076 8.414 9.342 7H6.658Zm8.499 4.3c.687-1.631 3-1.631 3.686 0l3.079 7.312a1 1 0 0 1-1.843.776L19.494 18h-4.988l-.584 1.388a1 1 0 0 1-1.843-.776l3.078-7.311Zm.191 4.7h3.304L17 12.077 15.348 16Z"
      fill="currentColor"
    />
  </Svg>
);
export default SvgTranslate;
