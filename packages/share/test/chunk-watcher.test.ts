import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../src/chunk-loader', async () => {
  const actual = await vi.importActual<typeof import('../src/chunk-loader')>('../src/chunk-loader');
  return { ...actual, loadChunk: vi.fn() };
});

import { watchChunkForChanges } from '../src/chunk-watcher';
import { loadChunk } from '../src/chunk-loader';

const URL = 'http://localhost:3001/button.chunk.js';

function textResponse(body: string) {
  return { text: () => Promise.resolve(body) } as Response;
}

describe('watchChunkForChanges', () => {
  const fetchSpy = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', fetchSpy);
    fetchSpy.mockReset();
    vi.mocked(loadChunk).mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('does not call onChange on the first poll (establishes baseline)', async () => {
    fetchSpy.mockResolvedValue(textResponse('v1'));
    const onChange = vi.fn();

    const stop = watchChunkForChanges(URL, onChange, { interval: 1000 });
    await vi.advanceTimersByTimeAsync(1000);

    expect(onChange).not.toHaveBeenCalled();
    stop();
  });

  it('calls onChange with the loaded module when content changes on a later poll', async () => {
    fetchSpy
      .mockResolvedValueOnce(textResponse('v1'))
      .mockResolvedValueOnce(textResponse('v2'));
    const mockModule = { default: vi.fn() };
    vi.mocked(loadChunk).mockResolvedValue(mockModule);
    const onChange = vi.fn();

    const stop = watchChunkForChanges(URL, onChange, { interval: 1000 });
    await vi.advanceTimersByTimeAsync(1000); // baseline: v1
    await vi.advanceTimersByTimeAsync(1000); // changed: v2

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(mockModule);
    expect(loadChunk).toHaveBeenCalledWith(URL, { cacheBust: true });
    stop();
  });

  it('does not call onChange when content is unchanged across polls', async () => {
    fetchSpy.mockResolvedValue(textResponse('v1'));
    const onChange = vi.fn();

    const stop = watchChunkForChanges(URL, onChange, { interval: 1000 });
    await vi.advanceTimersByTimeAsync(1000); // baseline
    await vi.advanceTimersByTimeAsync(1000); // unchanged

    expect(onChange).not.toHaveBeenCalled();
    stop();
  });

  it('swallows fetch errors and keeps polling on the next tick', async () => {
    fetchSpy
      .mockRejectedValueOnce(new Error('network blip'))
      .mockResolvedValueOnce(textResponse('v1'))
      .mockResolvedValueOnce(textResponse('v2'));
    const mockModule = { default: vi.fn() };
    vi.mocked(loadChunk).mockResolvedValue(mockModule);
    const onChange = vi.fn();

    const stop = watchChunkForChanges(URL, onChange, { interval: 1000 });
    await vi.advanceTimersByTimeAsync(1000); // errors — swallowed
    await vi.advanceTimersByTimeAsync(1000); // baseline: v1
    await vi.advanceTimersByTimeAsync(1000); // changed: v2

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(mockModule);
    stop();
  });

  it('stop() halts further polling', async () => {
    fetchSpy.mockResolvedValue(textResponse('v1'));

    const stop = watchChunkForChanges(URL, vi.fn(), { interval: 1000 });
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    stop();
    await vi.advanceTimersByTimeAsync(5000);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
