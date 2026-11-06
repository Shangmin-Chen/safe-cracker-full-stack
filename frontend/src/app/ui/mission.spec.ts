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

  it('moves from the briefing to the safe and unlocks the dossier after a verified result', async () => {
    const run = vi.fn().mockResolvedValue({
      attempts: 48,
      crackedCombination: '0800666666',
      timeTaken: 0.001,
      success: true,
    });
    const fixture = setup(run, false);
    const mission = fixture.componentInstance;
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('form')).toBeNull();
    expect(element.textContent).toContain('Enter the suite');

    mission.goToScene('dossier');
    expect(mission.scene()).toBe('briefing');
    element.querySelector<HTMLButtonElement>('.briefing .story-action')?.click();
    fixture.detectChanges();
    expect(element.textContent).toContain('Inspect the safe');
    element.querySelector<HTMLButtonElement>('.safe-hotspot')?.click();
    fixture.detectChanges();
    expect(element.querySelector('form')).not.toBeNull();

    await mission.start(new Event('submit'));
    fixture.detectChanges();
    element.querySelector<HTMLButtonElement>('.dossier-action')?.click();
    fixture.detectChanges();
    expect(element.textContent).toContain('Dossier recovered.');
    expect(element.textContent).toContain('0800666666');

    mission.restartMission();
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

    const trigger = fixture.nativeElement.querySelector('.text-button') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();
    expect(mission.replayAttempt()).toEqual(first);
    mission.moveReplay(1);
    expect(mission.replayAttempt()).toEqual(last);
    expect(mission.result()).toEqual(result);
    expect(mission.attemptCount()).toBe(48);
    expect(mission.elapsedTime()).toBe('0.000420');

    mission.closeReplay();
    fixture.detectChanges();
    expect(mission.replayIndex()).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('compares the same target with the other method and preserves the first result on retry', async () => {
    const target = '0800666666';
    const positional = {
      attempts: 48,
      crackedCombination: target,
      timeTaken: 0.001,
      success: true,
    };
    const backtracking = {
      attempts: 235,
      crackedCombination: target,
      timeTaken: 0.002,
      success: true,
    };
    const run = vi
      .fn()
      .mockResolvedValueOnce(positional)
      .mockRejectedValueOnce(new Error('Interrupted'))
      .mockResolvedValueOnce(backtracking);
    const fixture = setup(run);
    const mission = fixture.componentInstance;
    await mission.start(new Event('submit'));
    mission.goToScene('dossier');

    await mission.tryOtherMethod();
    expect(mission.scene()).toBe('decoder');
    expect(mission.phase()).toBe('error');
    expect(mission.comparison()).toBeNull();

    await mission.start(new Event('submit'));
    fixture.detectChanges();
    expect(run.mock.calls.map(([code, algorithm]) => [code, algorithm])).toEqual([
      [target, 'positional'],
      [target, 'backtracking'],
      [target, 'backtracking'],
    ]);
    expect(mission.scene()).toBe('dossier');
    expect(mission.comparison()).toEqual([
      { algorithm: 'positional', result: positional },
      { algorithm: 'backtracking', result: backtracking },
    ]);
    expect(fixture.nativeElement.querySelector('table')?.textContent).toContain('235');
    mission.restartMission();
    expect(mission.comparison()).toBeNull();
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
    mission.toggleReplay();
    expect(mission.replayIndex()).toBe(0);

    backtracking.click();
    fixture.detectChanges();
    expect(mission.algorithm()).toBe('backtracking');
    expect(mission.phase()).toBe('ready');
    expect(mission.result()).toBeNull();
    expect(mission.trace()).toEqual([]);
    expect(mission.replayIndex()).toBeNull();

    await mission.showAlgorithm();
    fixture.detectChanges();
    expect(readAlgorithm).toHaveBeenCalledWith('backtracking', expect.any(AbortSignal));
    expect(document.querySelector('mat-dialog-container code')?.textContent).toBe(implementation);

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
    expect(mission.trace()).toHaveLength(130);
    expect(mission.result()).toEqual(result);
    expect(mission.attemptCount()).toBe(4097);

    const trigger = fixture.nativeElement.querySelector('.text-button') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Sampled replay');
    expect(fixture.nativeElement.textContent).toContain('130 recorded probes from 4097 attempts');
    expect(fixture.nativeElement.textContent).toContain('Probe 1 of 4097');

    mission.moveReplay(128);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Probe 4096 of 4097');
    expect(mission.attemptCount()).toBe(4097);
    expect(mission.elapsedTime()).toBe('0.4100');
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
