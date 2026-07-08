/** A handler function that receives a DOM Event. May be async. */
export type HandlerFn = (event: Event) => void | Promise<void>;

export type Loader = () => Promise<{ default: HandlerFn }>;

export type PreloadStrategy = 'hover' | 'focus' | 'visible' | 'idle' | 'none';

export interface LazyHandlerOptions {
  event?: keyof HTMLElementEventMap;
  capture?: boolean;
  preloadOn?: PreloadStrategy | PreloadStrategy[];
  /**
   * Call `event.preventDefault()` synchronously the moment the event is intercepted,
   * before the handler module is loaded. Required for events with a native default
   * action that would otherwise fire before the async import resolves — e.g. `submit`
   * navigating the page, or a form `reset`. See `useLazyForm`.
   */
  preventDefault?: boolean;
  /** Called when the loader promise rejects — cold load or preload alike. */
  onError?: (error: Error) => void;
  /**
   * Skip `preloadOn` strategies on Save-Data or a slow (2g/slow-2g) connection,
   * so speculative preloads don't compete with the actual critical path on
   * constrained networks. The real trigger event is never skipped — only
   * speculative preloading. Default `true`.
   */
  respectConnection?: boolean;
}

/** A submit handler loaded lazily — see `useLazyForm`. */
export type FormHandlerFn = (event: SubmitEvent) => void | Promise<void>;
export type FormLoader = () => Promise<{ default: FormHandlerFn }>;
