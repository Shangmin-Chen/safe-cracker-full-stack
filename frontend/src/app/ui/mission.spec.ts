import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { CRACK_SAFE_GATEWAY } from '../crack-safe.token';
import type { CrackAlgorithm, CrackProgress, CrackResult } from '../application/crack-safe';
import { Mission } from './mission';

describe('Mission', () => {
  function setup(run: ReturnType<typeof vi.fn>, startAtDecoder = true, readAlgorithm = vi.fn()) {
    TestBed.configureTestingModule({
      imports: [Mission],
      providers: [{ provide: CRACK_SAFE_GATEWAY, useValue: { run, readAlgorithm } }],
    });
    const fixture = TestBed.createComponent(Mission);
    fixture.detectChanges();
    if (startAtDecoder) {
      fixture.componentInstance.goToScene('decoder');
      fixture.detectChanges();
    }
    return fixture;
  }

  it('moves from the briefing to the safe and shows replay in the decoder after a verified result', async () => {
    const run = vi.fn(
      async (
        target: string,
        _algorithm: CrackAlgorithm,
        onProgress: (progress: CrackProgress) => void,
      ) => {
        onProgress({ attempts: 1, currentCombination: '0000000000', timeTaken: 0.00001 });
        return { attempts: 48, crackedCombination: target, timeTaken: 0.001, success: true };
      },
    );
    const fixture = setup(run, false);
    const mission = fixture.componentInstance;
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('form')).toBeNull();
    expect(element.textContent).toContain('Enter the suite');

    element.querySelector<HTMLButtonElement>('.briefing .story-action')?.click();
    fixture.detectChanges();
    expect(element.textContent).toContain('Inspect the safe');
    element.querySelector<HTMLButtonElement>('.safe-hotspot')?.click();
    fixture.detectChanges();
    expect(element.querySelector('form')).not.toBeNull();

    await mission.start(new Event('submit'));
    fixture.detectChanges();
    expect(mission.scene()).toBe('decoder');
    expect(element.querySelector('#replay-title')?.textContent).toBe('Decoder replay');
    expect(element.textContent).toContain('0800666666');

    mission.goToScene('suite');
    expect(mission.scene()).toBe('suite');
    expect(mission.result()).toBeNull();
  });

  it('preserves leading zeros and keeps final statistics fixed during manual replay', async () => {
    const first = { attempts: 1, currentCombination: '0000000000', timeTaken: 0.00001 };
    const last = { attempts: 48, currentCombination: '0800666666', timeTaken: 0.00042 };
    const result = {
      attempts: 48,
      crackedCombination: '0800666666',
      timeTaken: 0.00042,
      success: true,
    };
    const run = vi.fn(
      async (
        _target: string,
        _algorithm: CrackAlgorithm,
        onProgress: (progress: CrackProgress) => void,
        _signal: AbortSignal,
      ) => {
        onProgress(first);
        onProgress(last);
        return result;
      },
    );
    const fixture = setup(run);
    const mission = fixture.componentInstance;

    await mission.start(new Event('submit'));
    fixture.detectChanges();
    expect(run.mock.calls[0][0]).toBe('0800666666');
    expect(run.mock.calls[0][1]).toBe('positional');
    expect(mission.phase()).toBe('opened');
    expect(fixture.nativeElement.textContent).toContain('Matches target');

    const replayGuess = () =>
      fixture.nativeElement.querySelector('.replay-guess code')?.textContent;
    expect(replayGuess()).toBe(first.currentCombination);
    mission.moveReplay(1);
    fixture.detectChanges();
    expect(replayGuess()).toBe(last.currentCombination);
    expect(mission.result()).toEqual(result);
    expect(mission.telemetry()[0].attempts).toBe(48);
    expect(mission.telemetry()[0].seconds).toBe(0.00042);
  });

  it('preserves the completed method if the second run fails', async () => {
    const positional = {
      attempts: 48,
      crackedCombination: '0800666666',
      timeTaken: 0.001,
      success: true,
    };
    const run = vi
      .fn()
      .mockImplementationOnce(
        async (
          _target: string,
          _algorithm: CrackAlgorithm,
          onProgress: (progress: CrackProgress) => void,
        ) => {
          onProgress({ attempts: 1, currentCombination: '0000000000', timeTaken: 0.00001 });
          return positional;
        },
      )
      .mockRejectedValueOnce(new Error('Interrupted'));
    const fixture = setup(run);
    const mission = fixture.componentInstance;
    mission.updateAlgorithm('both');

    await mission.start(new Event('submit'));
    fixture.detectChanges();
    expect(run.mock.calls.map(([code, algorithm]) => [code, algorithm])).toEqual([
      ['0800666666', 'positional'],
      ['0800666666', 'backtracking'],
    ]);
    expect(mission.phase()).toBe('error');
    expect(mission.result()).toEqual(positional);
    expect(mission.replayRun()?.algorithm).toBe('positional');
    expect(fixture.nativeElement.textContent).toContain('Positional matching completed');
  });

  it('rejects invalid input and reports connection failures without marking valid input invalid', async () => {
    const run = vi.fn().mockRejectedValue(new Error('The decoder could not connect.'));
    const fixture = setup(run);
    const mission = fixture.componentInstance;
    mission.target.set('１２３４５６７８９０');

    await mission.start(new Event('submit'));
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(run).not.toHaveBeenCalled();
    expect(input.getAttribute('aria-invalid')).toBe('true');

    mission.target.set('0800666666');
    await mission.start(new Event('submit'));
    fixture.detectChanges();
    expect(mission.phase()).toBe('error');
    expect(input.hasAttribute('aria-invalid')).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('The decoder could not connect.');
  });

  it('switches algorithms, explains each method, and clears the previous result', async () => {
    const run = vi.fn(
      async (
        _target: string,
        _algorithm: CrackAlgorithm,
        onProgress: (progress: CrackProgress) => void,
        _signal: AbortSignal,
      ) => {
        onProgress({ attempts: 1, currentCombination: '0000000000', timeTaken: 0.00001 });
        return {
          attempts: 1,
          crackedCombination: '0800666666',
          timeTaken: 0.00001,
          success: true,
        };
      },
    );
    const implementation = 'def crack_backtracking_attempts(port):\n    yield from search(port)\n';
    const readAlgorithm = vi.fn().mockResolvedValue(implementation);
    const fixture = setup(run, true, readAlgorithm);
    const mission = fixture.componentInstance;
    const element = fixture.nativeElement as HTMLElement;
    const backtracking = element.querySelector<HTMLButtonElement>('button[value="backtracking"]')!;

    expect(mission.algorithm()).toBe('positional');
    await mission.start(new Event('submit'));
    expect(mission.phase()).toBe('opened');
    expect(mission.replayIndex()).toBe(0);

    backtracking.click();
    fixture.detectChanges();
    expect(mission.algorithm()).toBe('backtracking');
    expect(mission.phase()).toBe('ready');
    expect(mission.result()).toBeNull();
    expect(mission.runs()).toEqual([]);
    expect(mission.replayRun()).toBeUndefined();

    await mission.showAlgorithm();
    fixture.detectChanges();
    expect(readAlgorithm).toHaveBeenCalledWith('backtracking', expect.any(AbortSignal));
    expect(document.querySelector('mat-dialog-container pre code')?.textContent).toBe(
      implementation,
    );

    await mission.start(new Event('submit'));
    expect(run.mock.calls.map(([target, algorithm]) => [target, algorithm])).toEqual([
      ['0800666666', 'positional'],
      ['0800666666', 'backtracking'],
    ]);
  });

  it('labels replay checkpoints as sampled and keeps final statistics exact', async () => {
    const result = {
      attempts: 4097,
      crackedCombination: '0800666666',
      timeTaken: 0.41,
      success: true,
    };
    const run = vi.fn(
      async (
        target: string,
        _algorithm: CrackAlgorithm,
        onProgress: (progress: CrackProgress) => void,
        _signal: AbortSignal,
      ) => {
        const attempts = [...Array.from({ length: 128 }, (_, index) => index + 1), 4096, 4097];
        for (const attempt of attempts) {
          onProgress({
            attempts: attempt,
            currentCombination: attempt === 4097 ? target : '0000000000',
            timeTaken: attempt / 10_000,
          });
        }
        return result;
      },
    );
    const fixture = setup(run);
    const mission = fixture.componentInstance;

    await mission.start(new Event('submit'));
    fixture.detectChanges();
    expect(mission.replayRun()?.probes).toHaveLength(130);
    expect(mission.result()).toEqual(result);
    expect(mission.telemetry()[0].attempts).toBe(4097);

    expect(fixture.nativeElement.textContent).toContain('Sampled replay');
    expect(fixture.nativeElement.textContent).toContain('130 recorded probes from 4097 attempts');
    expect(fixture.nativeElement.textContent).toContain('Probe 1 of 4097');

    mission.seekReplay(128);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Probe 4096 of 4097');
    expect(mission.telemetry()[0].attempts).toBe(4097);
    expect(mission.telemetry()[0].seconds).toBe(0.41);
  });

  it('blocks duplicate submissions and aborts an active request on destruction', async () => {
    let finish!: (result: CrackResult) => void;
    const run = vi.fn(
      (
        _target: string,
        _algorithm: CrackAlgorithm,
        _onProgress: (progress: CrackProgress) => void,
        _signal: AbortSignal,
      ) =>
        new Promise<CrackResult>((resolve) => {
          finish = resolve;
        }),
    );
    const fixture = setup(run);
    const mission = fixture.componentInstance;
    const pending = mission.start(new Event('submit'));

    await mission.start(new Event('submit'));
    expect(run).toHaveBeenCalledTimes(1);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector(
      'button[value="backtracking"]',
    ) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    button.click();
    expect(mission.algorithm()).toBe('positional');
    const signal = run.mock.calls[0][3] as AbortSignal;
    fixture.destroy();
    expect(signal.aborted).toBe(true);
    finish({ attempts: 1, crackedCombination: '0800666666', timeTaken: 0.001, success: true });
    await pending;
    expect(mission.result()).toBeNull();
  });
});
