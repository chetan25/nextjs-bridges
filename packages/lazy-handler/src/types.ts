/** A handler function that receives a DOM Event. May be async. */
export type HandlerFn = (event: Event) => void | Promise<void>;

export type Loader = () => Promise<{ default: HandlerFn }>;

export type PreloadStrategy = 'hover' | 'focus' | 'visible' | 'idle' | 'none';

export interface LazyHandlerOptions {
  event?: keyof HTMLElementEventMap;
  capture?: boolean;
  preloadOn?: PreloadStrategy | PreloadStrategy[];
}
