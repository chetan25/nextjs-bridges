import type { MountFunction } from './types';

export interface ChunkModule {
  default: MountFunction;
}

/**
 * Dynamically loads a pre-built JS chunk from a remote URL.
 *
 * The chunk must export a `mount(container, props) → unmount` function as its
 * default export. This keeps each remote app's React isolated in its own root
 * so the consumer never sees React elements created by a different React instance.
 *
 * The `turbopackIgnore` pragma suppresses Turbopack's static-analysis warning for
 * runtime-string dynamic imports.
 */
export function loadChunk(url: string): Promise<ChunkModule> {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore — intentional runtime-string dynamic import, analysed by turbopackIgnore
  return import(/* turbopackIgnore: true */ url) as Promise<ChunkModule>;
}
