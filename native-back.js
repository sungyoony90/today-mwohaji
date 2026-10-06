// The user confirmed the native back path on a physical device on 2026-10-05.
// Local browser previews retain their own controls; Toss uses its native bar.
export function installNativeBackBridge({ events, dispatchBack, close, onError }) {
  const unsubscribe = events.addEventListener('backEvent', {
    onEvent: () => {
      if (!dispatchBack()) Promise.resolve().then(close).catch(onError);
    },
    onError,
  });
  return unsubscribe;
}
