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
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { CRACK_SAFE_GATEWAY } from '../crack-safe.token';
import {
  isCombination,
  type CrackAlgorithm,
  type CrackProgress,
  type CrackResult,
} from '../application/crack-safe';

type MissionPhase = 'ready' | 'running' | 'opened' | 'error';
type MissionScene = 'briefing' | 'suite' | 'decoder' | 'dossier';
type AlgorithmSource = { status: 'loading' | 'error' } | { status: 'ready'; code: string };
type MethodResult = { algorithm: CrackAlgorithm; result: CrackResult };

const chapters: Record<MissionScene, string> = {
  briefing: '01 / Briefing',
  suite: '02 / The suite',
  decoder: '03 / The safe',
  dossier: '04 / Debrief',
};

@Component({
  selector: 'app-mission',
  standalone: true,
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
  ],
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
  private readonly firstMethod = signal<MethodResult | null>(null);
  readonly target = signal('0800666666');
  readonly algorithm = signal<CrackAlgorithm>('positional');
  readonly methodNames: Record<CrackAlgorithm, string> = {
    positional: 'Positional matching',
    backtracking: 'Backtracking',
  };
  readonly algorithmSource = signal<AlgorithmSource>({ status: 'loading' });
  readonly invalidTarget = computed(() => !isCombination(this.target()));
  readonly phase = signal<MissionPhase>('ready');
  readonly error = signal('');
  readonly trace = signal<CrackProgress[]>([]);
  readonly result = signal<CrackResult | null>(null);
  readonly replayIndex = signal<number | null>(null);
  private readonly replayTrigger = viewChild<ElementRef<HTMLButtonElement>>('replayTrigger');
  private readonly algorithmDialog = viewChild<TemplateRef<unknown>>('algorithmDialog');
  readonly lastProgress = computed(() => this.trace().at(-1));
  readonly algorithmLabel = computed(() => this.methodNames[this.algorithm()]);
  readonly comparison = computed(() => {
    const first = this.firstMethod();
    const result = this.result();
    if (!first || !result) return null;

    const second = { algorithm: this.algorithm(), result };
    return first.algorithm === 'positional' ? [first, second] : [second, first];
  });
  readonly replayIsSampled = computed(() => {
    const result = this.result();
    return result !== null && result.attempts > this.trace().length;
  });
  readonly currentGuess = computed(
    () =>
      this.result()?.crackedCombination ?? this.lastProgress()?.currentCombination ?? '——————————',
  );
  readonly guessDigits = computed(() => Array.from(this.currentGuess()));
  readonly attemptCount = computed(
    () => this.result()?.attempts ?? this.lastProgress()?.attempts ?? 0,
  );
  readonly elapsedTime = computed(() => {
    const seconds = this.result()?.timeTaken ?? this.lastProgress()?.timeTaken;
    return seconds === undefined ? '—' : this.formatTime(seconds);
  });
  readonly replayAttempt = computed(() => {
    const index = this.replayIndex();
    return index === null ? null : this.trace()[index];
  });
  readonly radioMessage = computed(() => {
    switch (this.phase()) {
      case 'running':
        return 'Decoder attached. Listening to the lock.';
      case 'opened':
        return 'We’re in. The dossier is secure.';
      case 'error':
        return 'The connection broke. Standing by for another attempt.';
      default:
        return 'Control, I’m at the safe. Ready when you are.';
    }
  });
  readonly telemetryNote = computed(() => {
    if (this.algorithm() === 'backtracking') {
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
    if (this.phase() === 'running' || (scene === 'dossier' && !this.result())) return;

    this.replayIndex.set(null);
    this.scene.set(scene);
    afterNextRender(() => this.sceneTitle()?.nativeElement.focus(), { injector: this.injector });
  }

  restartMission(): void {
    this.firstMethod.set(null);
    this.resetRun();
    this.goToScene('suite');
  }

  updateTarget(event: Event): void {
    const input = event.target as HTMLInputElement;
    const raw = input.value;
    const digits = raw.replace(/[^0-9]/g, '');
    if (digits !== raw) {
      const caret = raw.slice(0, input.selectionStart ?? raw.length).replace(/[^0-9]/g, '').length;
      input.value = digits;
      input.setSelectionRange(caret, caret);
    }
    if (digits === this.target()) return;

    this.target.set(digits);
    this.firstMethod.set(null);
    this.resetRun();
  }

  updateAlgorithm(selection: CrackAlgorithm): void {
    if (this.phase() === 'running' || selection === this.algorithm()) return;
    this.algorithm.set(selection);
    this.firstMethod.set(null);
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
      const code = await this.gateway.readAlgorithm(this.algorithm(), request.signal);
      if (!request.signal.aborted) this.algorithmSource.set({ status: 'ready', code });
    } catch {
      if (!request.signal.aborted) this.algorithmSource.set({ status: 'error' });
    } finally {
      if (this.sourceRequest === request) this.sourceRequest = null;
    }
  }

  randomize(): void {
    if (this.phase() === 'running') return;
    this.target.set(Array.from({ length: 10 }, () => Math.floor(Math.random() * 10)).join(''));
    this.firstMethod.set(null);
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

    const retryingComparison = this.phase() === 'error' && this.firstMethod() !== null;
    if (!retryingComparison) this.firstMethod.set(null);
    await this.runDecode(submittedTarget, retryingComparison);
  }

  async tryOtherMethod(): Promise<void> {
    const result = this.result();
    if (!result || this.phase() !== 'opened' || this.firstMethod() || this.scene() !== 'dossier') {
      return;
    }

    const algorithm = this.algorithm();
    this.firstMethod.set({ algorithm, result });
    this.algorithm.set(algorithm === 'positional' ? 'backtracking' : 'positional');
    this.target.set(result.crackedCombination);
    this.goToScene('decoder');
    await this.runDecode(result.crackedCombination, true);
  }

  private async runDecode(submittedTarget: string, comparing: boolean): Promise<void> {
    this.resetRun();
    this.phase.set('running');
    const controller = new AbortController();
    this.controller = controller;

    try {
      const result = await this.gateway.run(
        submittedTarget,
        this.algorithm(),
        (progress) => {
          if (this.controller === controller && !controller.signal.aborted) {
            this.trace.update((attempts) => [...attempts, progress]);
          }
        },
        controller.signal,
      );

      if (controller.signal.aborted) return;
      if (!result.success || result.crackedCombination !== submittedTarget) {
        throw new Error('The returned combination did not match the target. Try again.');
      }

      this.result.set(result);
      this.phase.set('opened');
      if (comparing) this.goToScene('dossier');
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

  toggleReplay(): void {
    if (this.replayIndex() !== null) {
      this.closeReplay();
    } else if (this.result() && this.trace().length) {
      this.replayIndex.set(0);
    }
  }

  closeReplay(): void {
    this.replayIndex.set(null);
    this.replayTrigger()?.nativeElement.focus();
  }

  moveReplay(direction: number): void {
    const index = this.replayIndex();
    if (index !== null) {
      this.replayIndex.set(Math.max(0, Math.min(this.trace().length - 1, index + direction)));
    }
  }

  formatTime(seconds: number): string {
    return seconds.toFixed(seconds < 0.001 ? 6 : seconds < 1 ? 4 : 2);
  }

  private resetRun(): void {
    this.phase.set('ready');
    this.error.set('');
    this.trace.set([]);
    this.result.set(null);
    this.replayIndex.set(null);
  }
}
