#!/bin/bash
set -eu

if [ "${1-}" = '--gpu-environment-ready' ]; then
  desktop_library_path=$2
  shift 2
  # Keep the provider's libraries ahead of the desktop and staged libraries.
  if [ -n "$desktop_library_path" ]; then
    export LD_LIBRARY_PATH="${LD_LIBRARY_PATH:+$LD_LIBRARY_PATH:}$desktop_library_path"
  fi
  exec "$@"
fi

if ! snapctl is-connected gpu-2404; then
  echo 'The gpu-2404 interface is not connected. Connect a GPU provider before starting OneKey.' >&2
  exit 1
fi

provider="$SNAP/gpu-2404/bin/gpu-2404-provider-wrapper"
if [ -x "$provider" ]; then
  desktop_library_path=${LD_LIBRARY_PATH-}
  # Providers append their paths. Restore desktop libraries only after that setup.
  if [ -n "${SNAP_LIBRARY_PATH-}" ]; then
    export LD_LIBRARY_PATH="$SNAP_LIBRARY_PATH"
  else
    unset LD_LIBRARY_PATH
  fi
  unset LIBGL_DRIVERS_PATH LIBVA_DRIVERS_PATH
  exec "$provider" /bin/bash "$0" --gpu-environment-ready "$desktop_library_path" "$@"
fi

# Older providers without the wrapper use one of these two Mesa layouts.
case "$SNAP_ARCH" in
  amd64) triplet=x86_64-linux-gnu ;;
  arm64) triplet=aarch64-linux-gnu ;;
  *) echo "Unsupported GPU architecture: $SNAP_ARCH" >&2; exit 1 ;;
esac

for root in "$SNAP/gpu-2404/mesa-2404/usr" "$SNAP/gpu-2404/usr"; do
  library="$root/lib/$triplet"
  if [ -r "$library/libgbm.so.1" ]; then
    export LD_LIBRARY_PATH="${SNAP_LIBRARY_PATH:+$SNAP_LIBRARY_PATH:}$library:$library/dri:$library/gbm${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
    export LIBGL_DRIVERS_PATH="$library/dri"
    export GBM_BACKENDS_PATH="$library/gbm${GBM_BACKENDS_PATH:+:$GBM_BACKENDS_PATH}"
    export __EGL_VENDOR_LIBRARY_DIRS="$root/share/glvnd/egl_vendor.d${__EGL_VENDOR_LIBRARY_DIRS:+:$__EGL_VENDOR_LIBRARY_DIRS}"
    exec "$@"
  fi
done

echo 'No usable GPU provider wrapper or Mesa library directory was found.' >&2
exit 1
