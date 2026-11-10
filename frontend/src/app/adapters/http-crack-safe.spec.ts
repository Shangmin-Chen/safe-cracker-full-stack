import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpCrackSafeGateway } from './http-crack-safe';

function streamResponse(...chunks: string[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(body, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8' } });
}

describe('HTTP crack safe gateway', () => {
  const gateway = new HttpCrackSafeGateway();

  afterEach(() => vi.unstubAllGlobals());

  it('posts the target and selected algorithm, then parses SSE across chunks', async () => {
    const response = streamResponse(
      'event: progress\r\ndata: {"attempts":1,"current_comb',
      'ination":"0000000000","time_taken":0.00002}\r\n\r',
      '\nevent: result\ndata: {"attempts":48,"cracked_combination":"0800666666",',
      '"time_taken":0.001,"success":true}\n\n',
    );
    const fetch = vi.fn().mockResolvedValue(response);
    vi.stubGlobal('fetch', fetch);
    const onProgress = vi.fn();
    const { signal } = new AbortController();

    await expect(gateway.run('0800666666', 'backtracking', onProgress, signal)).resolves.toEqual({
      attempts: 48,
      crackedCombination: '0800666666',
      timeTaken: 0.001,
      success: true,
    });
    expect(fetch).toHaveBeenCalledWith('/api/crack_safe/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: '{"actual_combination":"0800666666","algorithm":"backtracking"}',
      signal,
    });
    expect(onProgress.mock.calls).toEqual([
      [
        {
          attempts: 1,
          currentCombination: '0000000000',
          timeTaken: 0.00002,
        },
      ],
    ]);
  });

  it('reports an interrupted stream when it ends before the final result', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          streamResponse(
            'event: progress\ndata: {"attempts":1,"current_combination":"0000000000","time_taken":0}\n\n',
          ),
        ),
    );

    await expect(
      gateway.run('0800666666', 'positional', vi.fn(), new AbortController().signal),
    ).rejects.toThrow('ended before a result arrived');
  });

  it('preserves regression inference details without adding another attempt', async () => {
    const step = {
      attempts: 45,
      current_combination: '9876543210',
      time_taken: 0.001,
      phase: 'inferred',
      score: null,
      baseline_score: null,
      position: null,
      discovered_digits: '',
      fixed_prefix: '9876543210',
    };
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          streamResponse(
            'event: progress\ndata: ' +
              JSON.stringify(step) +
              '\n\n' +
              'event: result\ndata: {"attempts":45,"cracked_combination":"9876543210","time_taken":0.001,"success":true}\n\n',
          ),
        ),
    );
    const onProgress = vi.fn();
    const result = await gateway.run(
      '9876543210',
      'regression',
      onProgress,
      new AbortController().signal,
    );
    expect(result.attempts).toBe(45);
    expect(onProgress).toHaveBeenCalledWith({
      attempts: 45,
      currentCombination: '9876543210',
      timeTaken: 0.001,
      phase: 'inferred',
      score: null,
      baselineScore: null,
      position: null,
      discoveredDigits: '',
      fixedPrefix: '9876543210',
    });
  });

  it('rejects malformed step feedback', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          streamResponse(
            'event: progress\ndata: {"attempts":1,"current_combination":"1000000000","time_taken":0,"phase":"regression","score":11}\n\n',
          ),
        ),
    );
    await expect(
      gateway.run('9876543210', 'regression', vi.fn(), new AbortController().signal),
    ).rejects.toThrow('invalid step details');
  });

  it('surfaces the server message for a rejected request', async () => {
    const response = Response.json({ error: 'Invalid combination.' }, { status: 400 });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));

    await expect(
      gateway.run('123', 'positional', vi.fn(), new AbortController().signal),
    ).rejects.toThrow('Invalid combination.');
  });
});
