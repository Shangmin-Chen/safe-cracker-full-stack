import { createParser } from 'eventsource-parser';
import { isCombination } from '../application/crack-safe';
import type {
  CrackAlgorithm,
  CrackProgress,
  CrackResult,
  CrackSafeGateway,
} from '../application/crack-safe';

function readTelemetry(data: string) {
  const payload: unknown = JSON.parse(data);
  if (typeof payload !== 'object' || payload === null) {
    throw new Error('The decoder sent invalid telemetry.');
  }

  const fields = payload as Record<string, unknown>;
  const { attempts, time_taken: timeTaken } = fields;
  if (
    typeof attempts !== 'number' ||
    !Number.isSafeInteger(attempts) ||
    attempts < 1 ||
    typeof timeTaken !== 'number' ||
    !Number.isFinite(timeTaken) ||
    timeTaken < 0
  ) {
    throw new Error('The decoder sent invalid telemetry.');
  }

  return { fields, attempts, timeTaken };
}

export class HttpCrackSafeGateway implements CrackSafeGateway {
  async readAlgorithm(algorithm: CrackAlgorithm, signal: AbortSignal): Promise<string> {
    const response = await fetch(`/api/crack_safe/algorithms/${algorithm}/`, { signal });
    if (!response.ok) throw new Error('The algorithm source is unavailable.');

    const payload = (await response.json()) as { algorithm?: unknown; source?: unknown } | null;
    if (
      payload?.algorithm !== algorithm ||
      typeof payload.source !== 'string' ||
      !payload.source.trim()
    ) {
      throw new Error('The decoder returned invalid algorithm source.');
    }
    return payload.source;
  }

  async run(
    target: string,
    algorithm: CrackAlgorithm,
    onProgress: (progress: CrackProgress) => void,
    signal: AbortSignal,
  ): Promise<CrackResult> {
    const response = await fetch('/api/crack_safe/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({ actual_combination: target, algorithm }),
      signal,
    }).catch((error: unknown) => {
      signal.throwIfAborted();
      throw new Error('Could not connect to the decoder. Try again.', { cause: error });
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
      throw new Error(
        typeof body?.error === 'string' ? body.error : 'The decoder is unavailable. Try again.',
      );
    }

    const mediaType = response.headers.get('content-type')?.split(';', 1)[0].trim();
    if (mediaType !== 'text/event-stream' || !response.body) {
      throw new Error('The decoder did not send a live stream. Try again.');
    }

    let result: CrackResult | undefined;
    const parser = createParser({
      onEvent: ({ event, data }) => {
        if (result || (event !== 'progress' && event !== 'result')) return;

        const { fields, attempts, timeTaken } = readTelemetry(data);
        if (event === 'progress' && isCombination(fields['current_combination'])) {
          onProgress({ attempts, timeTaken, currentCombination: fields['current_combination'] });
          return;
        }

        if (
          event === 'result' &&
          isCombination(fields['cracked_combination']) &&
          typeof fields['success'] === 'boolean'
        ) {
          result = {
            attempts,
            timeTaken,
            crackedCombination: fields['cracked_combination'],
            success: fields['success'],
          };
          return;
        }

        throw new Error('The decoder sent invalid telemetry.');
      },
    });

    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    try {
      while (!result) {
        const { value, done } = await reader.read();
        signal.throwIfAborted();
        if (done) throw new Error('The decoder stream ended before a result arrived. Try again.');
        parser.feed(value);
      }
      return result;
    } catch (error) {
      signal.throwIfAborted();
      if (error instanceof SyntaxError || error instanceof TypeError) {
        throw new Error('The decoder stream was interrupted or invalid. Try again.', {
          cause: error,
        });
      }
      throw error;
    } finally {
      await reader.cancel().catch(() => undefined);
      reader.releaseLock();
    }
  }
}
