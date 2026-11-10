import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CRACK_SAFE_GATEWAY } from '../crack-safe.token';
import {
  isPermutation,
  type CrackAlgorithm,
  type CrackProgress,
  type CrackResult,
} from '../application/crack-safe';
import { Mission } from './mission';

describe('Mission', () => {
  afterEach(() => vi.useRealTimers());

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

  function successfulRun(steps?: CrackProgress[], attempts = 82) {
    return vi.fn(
      async (
        target: string,
        _algorithm: CrackAlgorithm,
        onProgress: (step: CrackProgress) => void,
      ) => {
        for (const step of steps ?? [
          { attempts: 1, currentCombination: '0000000000', timeTaken: 0.00001 },
          { attempts, currentCombination: target, timeTaken: 0.001 },
        ])
          onProgress(step);
        return { attempts, crackedCombination: target, timeTaken: 0.001, success: true };
      },
    );
  }

  it('moves from the briefing to the safe and presents recorded steps after a result', async () => {
    const fixture = setup(successfulRun(), false);
    const mission = fixture.componentInstance;
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('form')).toBeNull();
    element.querySelector<HTMLButtonElement>('.briefing .story-action')!.click();
    fixture.detectChanges();
    element.querySelector<HTMLButtonElement>('.safe-hotspot')!.click();
    fixture.detectChanges();
    await mission.start(new Event('submit'));
    fixture.detectChanges();
    expect(element.querySelector('#replay-title')?.textContent).toBe('Step visualization');
    expect(element.textContent).toContain('Matches target');
    mission.goToScene('suite');
    expect(mission.result()).toBeNull();
  });

  it('offers exactly the three algorithms and resets the previous run when switching', async () => {
    const fixture = setup(successfulRun());
    const mission = fixture.componentInstance;
    await mission.start(new Event('submit'));
    fixture.detectChanges();
    expect(mission.searchModes).toEqual(['positional', 'backtracking', 'regression']);
    expect(fixture.nativeElement.querySelectorAll('.algorithm-row button')).toHaveLength(3);
    fixture.nativeElement.querySelector('button[value="backtracking"]').click();
    fixture.detectChanges();
    expect(mission.algorithm()).toBe('backtracking');
    expect(mission.result()).toBeNull();
    expect(mission.replayRun()).toBeUndefined();
    expect(fixture.nativeElement.textContent).toContain('Discover the digits');
    expect(fixture.nativeElement.textContent).toContain('Backtrack through permutations');
  });

  it('keeps final attempts and execution time fixed during replay', async () => {
    const fixture = setup(successfulRun());
    const mission = fixture.componentInstance;
    await mission.start(new Event('submit'));
    fixture.detectChanges();
    const guess = () =>
      [...fixture.nativeElement.querySelectorAll('.digit-grid li')]
        .map((cell: unknown) => (cell as HTMLElement).textContent?.trim())
        .join('');
    expect(guess()).toBe('0000000000');
    mission.moveReplay(1);
    fixture.detectChanges();
    expect(guess()).toBe('0800666666');
    expect(mission.telemetry()[0].attempts).toBe(82);
    expect(mission.telemetry()[0].seconds).toBe(0.001);
    expect(fixture.nativeElement.textContent).toContain('Execution time');
  });

  it('enforces the regression constraint and generates valid examples and random codes', async () => {
    const run = successfulRun(undefined, 45);
    const fixture = setup(run);
    const mission = fixture.componentInstance;
    mission.updateAlgorithm('regression');
    await mission.start(new Event('submit'));
    fixture.detectChanges();
    expect(run).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(
      'each digit 0–9 exactly once',
    );
    mission.useExample();
    expect(mission.target()).toBe('9876543210');
    await mission.start(new Event('submit'));
    expect(run.mock.calls[0][1]).toBe('regression');
    mission.randomize();
    expect(isPermutation(mission.target())).toBe(true);
    expect(mission.result()).toBeNull();
  });

  it('shows discovery and permutation as separate backtracking stages', async () => {
    const target = '0100000000';
    const steps: CrackProgress[] = [
      {
        attempts: 1,
        currentCombination: '0000000000',
        timeTaken: 0.00001,
        phase: 'discovery',
        score: 9,
        discoveredDigits: '000000000',
      },
      {
        attempts: 2,
        currentCombination: '1111111111',
        timeTaken: 0.00002,
        phase: 'discovery',
        score: 1,
        discoveredDigits: '0000000001',
      },
      {
        attempts: 19,
        currentCombination: target,
        timeTaken: 0.001,
        phase: 'permutation',
        score: null,
        discoveredDigits: '0000000001',
      },
    ];
    const fixture = setup(successfulRun(steps, 19));
    const mission = fixture.componentInstance;
    mission.updateAlgorithm('backtracking');
    mission.target.set(target);
    await mission.start(new Event('submit'));
    fixture.detectChanges();
    expect(mission.stepStage()).toContain('Stage 1');
    expect(fixture.nativeElement.textContent).toContain('Discovered digits');
    mission.seekReplay(2);
    fixture.detectChanges();
    expect(mission.stepStage()).toContain('Stage 2');
    expect(mission.stepExplanation()).toContain('safe opens');
    expect(fixture.nativeElement.querySelector('.digit-pool code').textContent).toBe('0000000001');
  });

  it('visualizes regression inference without charging an extra attempt', async () => {
    const steps: CrackProgress[] = [
      {
        attempts: 1,
        currentCombination: '1000000000',
        timeTaken: 0.00001,
        phase: 'regression',
        score: 1,
        baselineScore: 1,
        position: 0,
        fixedPrefix: '',
      },
      {
        attempts: 45,
        currentCombination: '9876543210',
        timeTaken: 0.001,
        phase: 'inferred',
        score: null,
        fixedPrefix: '9876543210',
      },
    ];
    const fixture = setup(successfulRun(steps, 45));
    const mission = fixture.componentInstance;
    mission.updateAlgorithm('regression');
    mission.useExample();
    await mission.start(new Event('submit'));
    mission.seekReplay(1);
    fixture.detectChanges();
    expect(mission.stepStage()).toBe('Code inferred');
    expect(mission.stepExplanation()).toContain('without adding another scoring attempt');
    expect(fixture.nativeElement.querySelectorAll('.digit-fixed')).toHaveLength(10);
    expect(mission.telemetry()[0].attempts).toBe(45);
  });

  it('plays, pauses, changes speed, and stops at the final recorded step', async () => {
    vi.useFakeTimers();
    const steps = [1, 2, 3].map((attempts) => ({
      attempts,
      currentCombination: '0000000000',
      timeTaken: attempts / 10000,
    }));
    const fixture = setup(successfulRun(steps, 3));
    const mission = fixture.componentInstance;
    await mission.start(new Event('submit'));
    mission.togglePlayback();
    vi.advanceTimersByTime(500);
    expect(mission.replayIndex()).toBe(1);
    mission.togglePlayback();
    vi.advanceTimersByTime(1000);
    expect(mission.replayIndex()).toBe(1);
    mission.playbackSpeed.set(2);
    mission.togglePlayback();
    vi.advanceTimersByTime(250);
    expect(mission.replayIndex()).toBe(2);
    expect(mission.replayPlaying()).toBe(false);
    expect(mission.result()?.timeTaken).toBe(0.001);
    fixture.destroy();
  });

  it('shows sampled traces with original attempt numbers and exact final totals', async () => {
    const steps = [1, 4096, 4097].map((attempts) => ({
      attempts,
      currentCombination: '0000000000',
      timeTaken: attempts / 10000,
    }));
    const fixture = setup(successfulRun(steps, 4097));
    const mission = fixture.componentInstance;
    await mission.start(new Event('submit'));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Sampled replay');
    expect(fixture.nativeElement.textContent).toContain('3 recorded steps from 4097 attempts');
    mission.seekReplay(1);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Attempt 4096 of 4097');
    expect(mission.telemetry()[0].attempts).toBe(4097);
  });

  it('loads the selected complete Python file with its explanation', async () => {
    const code =
      'from time import perf_counter\n\ndef sound_tool(actual, guess): pass\n\ndef crack_safe(actual): pass';
    const readAlgorithm = vi.fn().mockResolvedValue(code);
    const fixture = setup(successfulRun(), true, readAlgorithm);
    const mission = fixture.componentInstance;
    mission.updateAlgorithm('regression');
    await mission.showAlgorithm();
    fixture.detectChanges();
    expect(readAlgorithm).toHaveBeenCalledWith('regression', expect.any(AbortSignal));
    expect(document.querySelector('.source-filename code')?.textContent).toBe(
      'backend/regression.py',
    );
    expect(document.querySelector('mat-dialog-container pre code')?.textContent).toBe(code);
    expect(document.querySelector('mat-dialog-container')?.textContent).toContain(
      'Eliminate candidates',
    );
  });

  it('rejects malformed input and surfaces connection failures', async () => {
    const run = vi.fn().mockRejectedValue(new Error('The decoder could not connect.'));
    const fixture = setup(run);
    const mission = fixture.componentInstance;
    mission.target.set('１２３４５６７８９０');
    await mission.start(new Event('submit'));
    fixture.detectChanges();
    expect(run).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('input').getAttribute('aria-invalid')).toBe('true');
    mission.target.set('0800666666');
    await mission.start(new Event('submit'));
    fixture.detectChanges();
    expect(mission.phase()).toBe('error');
    expect(fixture.nativeElement.querySelector('input').hasAttribute('aria-invalid')).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('The decoder could not connect.');
  });

  it('blocks duplicate submissions and aborts an active request on destruction', async () => {
    let finish!: (result: CrackResult) => void;
    const run = vi.fn(
      (
        _target: string,
        _algorithm: CrackAlgorithm,
        _progress: (step: CrackProgress) => void,
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
    fixture.detectChanges();
    expect(run).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.querySelector('button[value="regression"]').disabled).toBe(true);
    const signal = run.mock.calls[0][3];
    fixture.destroy();
    expect(signal.aborted).toBe(true);
    finish({ attempts: 1, crackedCombination: '0800666666', timeTaken: 0.001, success: true });
    await pending;
    expect(mission.result()).toBeNull();
  });
});
