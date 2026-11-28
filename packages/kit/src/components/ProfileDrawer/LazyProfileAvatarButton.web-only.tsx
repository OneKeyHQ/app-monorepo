// The web app's header never shows the profile avatar (MDHeader renders it on
// native only). Without this stub the web app would load the avatar frame and
// the drawer store at startup.
export function LazyProfileAvatarButton() {
  return null;
}
