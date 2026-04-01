type GaParams = Record<string, string | number | boolean | null | undefined>;

type GtagFn = (command: 'event', eventName: string, params?: GaParams) => void;

const getGtag = (): GtagFn | null => {
  if (typeof window === 'undefined') return null;
  const maybe = (window as Window & { gtag?: unknown }).gtag;
  return typeof maybe === 'function' ? (maybe as GtagFn) : null;
};

export const trackGaEvent = (eventName: string, params?: GaParams) => {
  const gtag = getGtag();
  if (!gtag) return;
  gtag('event', eventName, { ...params, debug_mode: true });
};
