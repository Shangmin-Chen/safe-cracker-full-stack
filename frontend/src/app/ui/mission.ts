import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  signal,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule, type MatDialogRef } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSliderModule } from '@angular/material/slider';
import { CRACK_SAFE_GATEWAY } from '../crack-safe.token';
import {
  COMBINATION_LENGTH,
  isCombination,
  isPermutation,
  type CrackAlgorithm,
  type CrackProgress,
  type CrackResult,
} from '../application/crack-safe';
import { ALGORITHM_INFO } from './algorithm-info';

type MissionPhase = 'ready' | 'running' | 'opened' | 'error';
type MissionScene = 'briefing' | 'suite' | 'decoder';
type AlgorithmSource =
  | { status: 'loading' | 'error' }
  | { status: 'ready'; entries: { algorithm: CrackAlgorithm; code: string }[] };
type CompletedRun = { algorithm: CrackAlgorithm; result: CrackResult; probes: CrackProgress[] };

const chapters: Record<MissionScene, string> = {
  briefing: '01 / Briefing',
  suite: '02 / The suite',
  decoder: '03 / The safe',
};

@Component({
  selector: 'app-mission',
  standalone: true,
  imports: [MatButtonModule, MatDialogModule, MatProgressBarModule, MatSliderModule],
  templateUrl: './mission.html',
  styleUrls: ['./mission.css', './experience.css'],
})
export class Mission {
  private readonly gateway = inject(CRACK_SAFE_GATEWAY);
  private readonly injector = inject(Injector);
  private readonly dialog = inject(MatDialog);
  private controller: AbortController | null = null;
  private sourceRequest: AbortController | null = null;
  private sourceDialog: MatDialogRef<unknown> | null = null;
  private playbackTimer: ReturnType<typeof setInterval> | null = null;
  private waitingTimer: ReturnType<typeof setInterval> | null = null;

  readonly scene = signal<MissionScene>('briefing');
  readonly chapter = computed(() => chapters[this.scene()]);
  private readonly sceneTitle = viewChild<ElementRef<HTMLElement>>('sceneTitle');
  readonly target = signal('0800666666');
  readonly algorithm = signal<CrackAlgorithm>('positional');
  readonly searchModes: CrackAlgorithm[] = ['positional', 'backtracking', 'regression'];
  readonly info = ALGORITHM_INFO;
  readonly methodNames = {
    positional: ALGORITHM_INFO.positional.name,
    backtracking: ALGORITHM_INFO.backtracking.name,
    regression: ALGORITHM_INFO.regression.name,
  };
  readonly algorithmInfo = computed(() => this.info[this.algorithm()]);
  readonly algorithmLabel = computed(() => this.methodNames[this.algorithm()]);
  readonly algorithmSource = signal<AlgorithmSource>({ status: 'loading' });
  readonly invalidTarget = computed(
    () =>
      !isCombination(this.target()) ||
      (this.algorithm() === 'regression' && !isPermutation(this.target())),
  );
  readonly phase = signal<MissionPhase>('ready');
  readonly error = signal('');
  readonly runs = signal<CompletedRun[]>([]);
  readonly waitingSeconds = signal(0);
  readonly replayPlaying = signal(false);
  readonly playbackSpeed = signal(1);
  readonly replayIndex = signal(0);
  private readonly progress = signal<CrackProgress | null>(null);
  private readonly algorithmDialog = viewChild<TemplateRef<unknown>>('algorithmDialog');
  readonly result = computed(() =>
    this.phase() === 'running' ? null : (this.runs()[0]?.result ?? null),
  );
  readonly replayRun = computed(() => (this.phase() === 'running' ? undefined : this.runs()[0]));
  readonly replayStep = computed(() => this.replayRun()?.probes[this.replayIndex()]);
  readonly replayIsSampled = computed(() => {
    const run = this.replayRun();
    if (!run) return false;
    const attempts = new Set(
      run.probes.filter((step) => step.phase !== 'inferred').map((step) => step.attempts),
    );
    return attempts.size < run.result.attempts;
  });
  readonly stepCells = computed(() => {
    const step = this.replayStep();
    if (!step) return [];
    const previous = this.replayRun()?.probes[this.replayIndex() - 1];
    return [...step.currentCombination].map((digit, index) => ({
      digit,
      index,
      active: index === step.position,
      fixed: step.fixedPrefix?.[index] === digit,
      changed: !!previous && previous.currentCombination[index] !== digit,
    }));
  });
  readonly stepStage = computed(() => {
    switch (this.replayStep()?.phase) {
      case 'baseline':
        return 'Starting score';
      case 'position':
        return 'Improve a position';
      case 'discovery':
        return 'Stage 1 · Discover digits';
      case 'permutation':
        return 'Stage 2 · Try permutations';
      case 'regression':
        return 'Flip and eliminate';
      case 'inferred':
        return 'Code inferred';
      default:
        return 'Recorded attempt';
    }
  });
  readonly stepExplanation = computed(() => {
    const step = this.replayStep();
    if (!step) return '';
    const position = (step.position ?? 0) + 1;
    switch (step.phase) {
      case 'baseline':
        return 'Begin with ten zeros. The score tells us how many digits are already in the correct position.';
      case 'position':
        return (
          'Try ' +
          step.currentCombination[step.position ?? 0] +
          ' at position ' +
          position +
          '. The score changes from ' +
          step.baselineScore +
          ' to ' +
          step.score +
          (step.score! > step.baselineScore!
            ? '. Keep this improvement and move to the next position.'
            : '. Keep the previous best combination and try the next digit.')
        );
      case 'discovery':
        return (
          'The digit ' +
          step.currentCombination[0] +
          ' occurs ' +
          step.score +
          ' time' +
          (step.score === 1 ? '' : 's') +
          '. These counts build the pool for the next stage.'
        );
      case 'permutation':
        return step.currentCombination === this.target()
          ? 'This complete permutation matches the target. The safe opens and backtracking stops.'
          : 'Test a complete permutation of the discovered digits. It does not open the safe, so backtrack to the next ordering.';
      case 'regression':
        return (
          'Flip position ' +
          position +
          ' in the sequence for candidate ' +
          step.currentCombination.at(-1) +
          '. Expected score: ' +
          step.baselineScore +
          '; measured: ' +
          step.score +
          (step.score! < step.baselineScore!
            ? '. A regression identifies this candidate.'
            : '. No regression: eliminate this candidate. The last untested candidate can be inferred.')
        );
      case 'inferred':
        return 'All positions are determined by elimination. The final code is inferred without adding another scoring attempt.';
      default:
        return 'A combination recorded during the actual algorithm run.';
    }
  });
  readonly telemetry = computed(() => {
    const result = this.result();
    const progress = this.progress();
    return [
      {
        algorithm: this.algorithm(),
        status: result
          ? 'Complete'
          : this.phase() === 'running'
            ? 'Computing'
            : this.phase() === 'error'
              ? 'Interrupted'
              : 'Ready',
        guess: result?.crackedCombination ?? progress?.currentCombination ?? '—',
        attempts: result?.attempts ?? progress?.attempts ?? 0,
        seconds: result?.timeTaken ?? progress?.timeTaken,
      },
    ];
  });
  readonly radioMessage = computed(() =>
    this.phase() === 'running'
      ? 'Decoder attached. Listening to the lock.'
      : this.phase() === 'opened'
        ? 'We’re in. The combination is recovered.'
        : this.phase() === 'error'
          ? 'The decode stopped. Ready to try again.'
          : 'Control, I’m at the safe. Ready when you are.',
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.controller?.abort();
      this.sourceRequest?.abort();
      this.sourceDialog?.close();
      this.pausePlayback();
      this.stopWaiting();
    });
  }

  goToScene(scene: MissionScene): void {
    if (this.phase() === 'running') return;
    if (scene === 'suite') this.resetRun();
    this.scene.set(scene);
    afterNextRender(() => this.sceneTitle()?.nativeElement.focus(), { injector: this.injector });
  }

  updateTarget(event: Event): void {
    const input = event.target as HTMLInputElement;
    const raw = input.value;
    const digits = raw.replace(/[^0-9]/g, '').slice(0, COMBINATION_LENGTH);
    if (digits !== raw) {
      const caret = Math.min(
        digits.length,
        raw.slice(0, input.selectionStart ?? raw.length).replace(/[^0-9]/g, '').length,
      );
      input.value = digits;
      input.setSelectionRange(caret, caret);
    }
    if (digits === this.target()) return;
    this.target.set(digits);
    this.resetRun();
  }

  updateAlgorithm(selection: CrackAlgorithm): void {
    if (this.phase() === 'running' || selection === this.algorithm()) return;
    this.algorithm.set(selection);
    this.resetRun();
  }

  useExample(): void {
    if (this.phase() === 'running') return;
    this.target.set(this.algorithmInfo().example);
    this.resetRun();
  }

  async showAlgorithm(): Promise<void> {
    const template = this.algorithmDialog();
    if (!template || this.sourceDialog) return;
    this.pausePlayback();
    const algorithm = this.algorithm();
    const request = new AbortController();
    this.sourceRequest = request;
    this.algorithmSource.set({ status: 'loading' });
    const dialog = this.dialog.open(template, { width: '900px', maxWidth: 'calc(100vw - 24px)' });
    this.sourceDialog = dialog;
    dialog.beforeClosed().subscribe(() => request.abort());
    dialog.afterClosed().subscribe(() => {
      this.sourceDialog = null;
    });
    try {
      const code = await this.gateway.readAlgorithm(algorithm, request.signal);
      if (!request.signal.aborted)
        this.algorithmSource.set({ status: 'ready', entries: [{ algorithm, code }] });
    } catch {
      if (!request.signal.aborted) this.algorithmSource.set({ status: 'error' });
    } finally {
      if (this.sourceRequest === request) this.sourceRequest = null;
    }
  }

  randomize(): void {
    if (this.phase() === 'running') return;
    if (this.algorithm() === 'regression') {
      const digits = [...'0123456789'];
      for (let index = digits.length - 1; index > 0; index--) {
        const other = Math.floor(Math.random() * (index + 1));
        [digits[index], digits[other]] = [digits[other], digits[index]];
      }
      this.target.set(digits.join(''));
    } else {
      this.target.set(
        Array.from({ length: COMBINATION_LENGTH }, () => Math.floor(Math.random() * 10)).join(''),
      );
    }
    this.resetRun();
  }

  async start(event: Event): Promise<void> {
    event.preventDefault();
    if (this.phase() === 'running') return;
    if (this.invalidTarget()) {
      this.error.set(
        this.algorithm() === 'regression' && isCombination(this.target())
          ? 'Regression requires each digit 0–9 exactly once. Use the example or Random.'
          : 'Enter exactly 10 digits, using 0–9.',
      );
      return;
    }
    this.resetRun();
    this.phase.set('running');
    const controller = new AbortController();
    this.controller = controller;
    const startedAt = performance.now();
    this.waitingTimer = setInterval(
      () => this.waitingSeconds.set((performance.now() - startedAt) / 1000),
      100,
    );
    const algorithm = this.algorithm();
    const submittedTarget = this.target();
    try {
      const probes: CrackProgress[] = [];
      const result = await this.gateway.run(
        submittedTarget,
        algorithm,
        (progress) => {
          if (!controller.signal.aborted) {
            probes.push(progress);
            this.progress.set(progress);
          }
        },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      if (!result.success || result.crackedCombination !== submittedTarget) {
        throw new Error('The returned combination did not match the target. Try again.');
      }
      this.runs.set([{ algorithm, result, probes }]);
      this.phase.set('opened');
    } catch (error) {
      if (controller.signal.aborted) return;
      this.error.set(
        error instanceof Error ? error.message : 'The decoder could not connect. Try again.',
      );
      this.phase.set('error');
    } finally {
      this.stopWaiting();
      if (this.controller === controller) this.controller = null;
    }
  }

  moveReplay(direction: number): void {
    this.seekReplay(this.replayIndex() + direction);
  }

  seekReplay(index: number): void {
    this.pausePlayback();
    const run = this.replayRun();
    if (run) this.replayIndex.set(Math.max(0, Math.min(run.probes.length - 1, index)));
  }

  togglePlayback(): void {
    if (this.replayPlaying()) {
      this.pausePlayback();
      return;
    }
    const run = this.replayRun();
    if (!run || run.probes.length < 2) return;
    if (this.replayIndex() >= run.probes.length - 1) this.replayIndex.set(0);
    this.replayPlaying.set(true);
    this.playbackTimer = setInterval(() => {
      const last = (this.replayRun()?.probes.length ?? 1) - 1;
      this.replayIndex.update((index) => Math.min(index + 1, last));
      if (this.replayIndex() >= last) this.pausePlayback();
    }, 500 / this.playbackSpeed());
  }

  changeSpeed(event: Event): void {
    const wasPlaying = this.replayPlaying();
    this.pausePlayback();
    this.playbackSpeed.set(Number((event.target as HTMLSelectElement).value));
    if (wasPlaying) this.togglePlayback();
  }

  private pausePlayback(): void {
    if (this.playbackTimer !== null) clearInterval(this.playbackTimer);
    this.playbackTimer = null;
    this.replayPlaying.set(false);
  }

  formatTime(seconds: number): string {
    return seconds.toFixed(seconds < 0.001 ? 6 : seconds < 1 ? 4 : 2);
  }

  private stopWaiting(): void {
    if (this.waitingTimer !== null) clearInterval(this.waitingTimer);
    this.waitingTimer = null;
  }

  private resetRun(): void {
    this.pausePlayback();
    this.phase.set('ready');
    this.error.set('');
    this.progress.set(null);
    this.runs.set([]);
    this.replayIndex.set(0);
    this.waitingSeconds.set(0);
  }
}
