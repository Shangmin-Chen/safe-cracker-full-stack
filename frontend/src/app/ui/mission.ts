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
  type CrackAlgorithm,
  type CrackProgress,
  type CrackResult,
} from '../application/crack-safe';

type MissionPhase = 'ready' | 'running' | 'opened' | 'error';
type MissionScene = 'briefing' | 'suite' | 'decoder';
type SearchMode = CrackAlgorithm | 'both';
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

  readonly scene = signal<MissionScene>('briefing');
  readonly chapter = computed(() => chapters[this.scene()]);
  private readonly sceneTitle = viewChild<ElementRef<HTMLElement>>('sceneTitle');
  readonly target = signal('0800666666');
  readonly algorithm = signal<SearchMode>('positional');
  readonly searchModes: SearchMode[] = ['positional', 'backtracking', 'both'];
  readonly methodNames: Record<SearchMode, string> = {
    positional: 'Positional matching',
    backtracking: 'Backtracking',
    both: 'Both',
  };
  readonly algorithmSource = signal<AlgorithmSource>({ status: 'loading' });
  readonly invalidTarget = computed(() => !isCombination(this.target()));
  readonly phase = signal<MissionPhase>('ready');
  readonly error = signal('');
  readonly runs = signal<CompletedRun[]>([]);
  private readonly liveRun = signal<{
    algorithm: CrackAlgorithm;
    progress: CrackProgress | null;
  } | null>(null);
  private readonly replayPositions = signal<Partial<Record<CrackAlgorithm, number>>>({});
  private readonly replayAlgorithm = signal<CrackAlgorithm | null>(null);
  private readonly algorithmDialog = viewChild<TemplateRef<unknown>>('algorithmDialog');
  private readonly selectedAlgorithms = computed<CrackAlgorithm[]>(() => {
    const mode = this.algorithm();
    return mode === 'both' ? ['positional', 'backtracking'] : [mode];
  });
  readonly algorithmLabel = computed(() => this.methodNames[this.algorithm()]);
  readonly result = computed(() =>
    this.phase() === 'running' ? null : (this.runs().at(-1)?.result ?? null),
  );
  readonly replayRuns = computed(() =>
    this.phase() === 'running' ? [] : this.runs().filter((run) => run.probes.length > 0),
  );
  readonly replayRun = computed(() => {
    const runs = this.replayRuns();
    return runs.find((run) => run.algorithm === this.replayAlgorithm()) ?? runs[0];
  });
  readonly replayIndex = computed(() => {
    const run = this.replayRun();
    return run ? (this.replayPositions()[run.algorithm] ?? 0) : 0;
  });
  readonly replayIsSampled = computed(() => {
    const run = this.replayRun();
    return !!run && run.result.attempts > run.probes.length;
  });
  readonly telemetry = computed(() => {
    const phase = this.phase();
    const runs = this.runs();
    const liveRun = this.liveRun();
    return this.selectedAlgorithms().map((algorithm) => {
      const result = runs.find((run) => run.algorithm === algorithm)?.result;
      const isActive = liveRun?.algorithm === algorithm;
      const progress = isActive ? liveRun.progress : null;
      return {
        algorithm,
        status: result
          ? 'Opened'
          : isActive
            ? phase === 'error'
              ? 'Interrupted'
              : 'Live'
            : phase === 'running'
              ? 'Queued'
              : 'Standby',
        guess: result?.crackedCombination ?? progress?.currentCombination ?? '—',
        attempts: result?.attempts ?? progress?.attempts ?? 0,
        seconds: result?.timeTaken ?? progress?.timeTaken,
      };
    });
  });
  readonly radioMessage = computed(() => {
    switch (this.phase()) {
      case 'running':
        return 'Decoder attached. Listening to the lock.';
      case 'opened':
        return 'We’re in. The safe is open.';
      case 'error':
        return 'The decode stopped. Ready to try again.';
      default:
        return 'Control, I’m at the safe. Ready when you are.';
    }
  });
  readonly telemetryNote = computed(() => {
    const algorithm = this.liveRun()?.algorithm ?? this.algorithm();
    if (algorithm === 'both')
      return 'Runs positional matching, then backtracking on the same code.';
    if (algorithm === 'backtracking') {
      return this.phase() === 'running'
        ? 'The decoder is checking digit counts and candidate orders.'
        : 'Count repeated digits, then test each unique ordering until the safe opens.';
    }
    return this.phase() === 'running'
      ? 'Each probe listens for digits in the correct position.'
      : 'The first probe starts at 0000000000.';
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.controller?.abort();
      this.sourceRequest?.abort();
      this.sourceDialog?.close();
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

  updateAlgorithm(selection: SearchMode): void {
    if (this.phase() === 'running' || selection === this.algorithm()) return;
    this.algorithm.set(selection);
    this.resetRun();
  }

  async showAlgorithm(): Promise<void> {
    const template = this.algorithmDialog();
    if (!template || this.sourceDialog) return;

    const request = new AbortController();
    this.sourceRequest = request;
    this.algorithmSource.set({ status: 'loading' });
    const dialog = this.dialog.open(template, { width: '760px', maxWidth: 'calc(100vw - 24px)' });
    this.sourceDialog = dialog;
    dialog.beforeClosed().subscribe(() => request.abort());
    dialog.afterClosed().subscribe(() => {
      this.sourceDialog = null;
    });

    try {
      const entries = await Promise.all(
        this.selectedAlgorithms().map(async (algorithm) => ({
          algorithm,
          code: await this.gateway.readAlgorithm(algorithm, request.signal),
        })),
      );
      if (!request.signal.aborted) this.algorithmSource.set({ status: 'ready', entries });
    } catch {
      if (!request.signal.aborted) this.algorithmSource.set({ status: 'error' });
    } finally {
      if (this.sourceRequest === request) this.sourceRequest = null;
    }
  }

  randomize(): void {
    if (this.phase() === 'running') return;
    this.target.set(
      Array.from({ length: COMBINATION_LENGTH }, () => Math.floor(Math.random() * 10)).join(''),
    );
    this.resetRun();
  }

  async start(event: Event): Promise<void> {
    event.preventDefault();
    if (this.phase() === 'running') return;

    const submittedTarget = this.target();
    if (!isCombination(submittedTarget)) {
      this.error.set('Enter exactly 10 digits, using 0–9.');
      return;
    }

    this.resetRun();
    this.phase.set('running');
    const controller = new AbortController();
    this.controller = controller;

    try {
      for (const algorithm of this.selectedAlgorithms()) {
        this.liveRun.set({ algorithm, progress: null });
        const probes: CrackProgress[] = [];
        const result = await this.gateway.run(
          submittedTarget,
          algorithm,
          (progress) => {
            if (!controller.signal.aborted) {
              probes.push(progress);
              this.liveRun.set({ algorithm, progress });
            }
          },
          controller.signal,
        );

        if (controller.signal.aborted) return;
        if (!result.success || result.crackedCombination !== submittedTarget) {
          throw new Error('The returned combination did not match the target. Try again.');
        }

        this.runs.update((runs) => [...runs, { algorithm, result, probes }]);
      }
      this.phase.set('opened');
    } catch (error) {
      if (controller.signal.aborted) return;
      this.error.set(
        error instanceof Error ? error.message : 'The decoder could not connect. Try again.',
      );
      this.phase.set('error');
    } finally {
      if (this.controller === controller) this.controller = null;
    }
  }

  selectReplay(algorithm: CrackAlgorithm): void {
    this.replayAlgorithm.set(algorithm);
  }

  moveReplay(direction: number): void {
    this.seekReplay(this.replayIndex() + direction);
  }

  seekReplay(index: number): void {
    const run = this.replayRun();
    if (!run) return;
    const next = Math.max(0, Math.min(run.probes.length - 1, index));
    if (next === this.replayIndex()) return;
    this.replayPositions.update((positions) => ({ ...positions, [run.algorithm]: next }));
  }

  formatTime(seconds: number): string {
    return seconds.toFixed(seconds < 0.001 ? 6 : seconds < 1 ? 4 : 2);
  }

  private resetRun(): void {
    this.phase.set('ready');
    this.error.set('');
    this.liveRun.set(null);
    this.runs.set([]);
    this.replayAlgorithm.set(null);
    this.replayPositions.set({});
  }
}
