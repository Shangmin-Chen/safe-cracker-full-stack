import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

async function checkAccessibility(page: Page, scene: string): Promise<void> {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(violations, scene).toEqual([]);
}

async function mockDecoder(page: Page, requests: unknown[] = []): Promise<void> {
  await page.route('**/api/crack_safe/**', async (route) => {
    if (route.request().method() === 'GET') {
      const algorithm = new URL(route.request().url()).pathname.split('/').at(-2);
      await route.fulfill({
        json: {
          algorithm,
          source: [
            'from time import perf_counter',
            '',
            'def sound_tool(actual_combination, combination):',
            '    return 0',
            '',
            'def crack_safe(actual_combination, on_step=None):',
            '    return {"attempts": 45, "time_taken": 0.0123}',
          ].join('\n'),
        },
      });
      return;
    }
    const request = route.request().postDataJSON() as {
      algorithm: string;
      actual_combination: string;
    };
    requests.push(request);
    const target = request.actual_combination;
    const attempts =
      request.algorithm === 'positional' ? 82 : request.algorithm === 'backtracking' ? 235 : 45;
    const steps =
      request.algorithm === 'positional'
        ? [
            { attempts: 1, phase: 'baseline', current_combination: '0000000000', score: 3 },
            {
              attempts: 12,
              phase: 'position',
              current_combination: '0800000000',
              score: 4,
              baseline_score: 3,
              position: 1,
              fixed_prefix: '08',
            },
            {
              attempts,
              phase: 'position',
              current_combination: target,
              score: 10,
              baseline_score: 9,
              position: 9,
              fixed_prefix: target,
            },
          ]
        : request.algorithm === 'backtracking'
          ? [
              {
                attempts: 1,
                phase: 'discovery',
                current_combination: '0000000000',
                score: 3,
                discovered_digits: '000',
              },
              {
                attempts: 7,
                phase: 'discovery',
                current_combination: '6666666666',
                score: 6,
                discovered_digits: '000666666',
              },
              {
                attempts: 9,
                phase: 'discovery',
                current_combination: '8888888888',
                score: 1,
                discovered_digits: '0006666668',
              },
              {
                attempts: 11,
                phase: 'permutation',
                current_combination: '0006666668',
                discovered_digits: '0006666668',
              },
              {
                attempts,
                phase: 'permutation',
                current_combination: target,
                discovered_digits: '0006666668',
              },
            ]
          : [
              {
                attempts: 1,
                phase: 'regression',
                current_combination: '1000000000',
                score: 1,
                baseline_score: 1,
                position: 0,
              },
              {
                attempts: 18,
                phase: 'regression',
                current_combination: '9810000000',
                score: 3,
                baseline_score: 3,
                position: 2,
                fixed_prefix: '98',
              },
              { attempts, phase: 'inferred', current_combination: target, fixed_prefix: target },
            ];
    const progress = steps.map((step, index) => ({
      score: null,
      baseline_score: null,
      position: null,
      discovered_digits: '',
      fixed_prefix: '',
      ...step,
      time_taken: index === steps.length - 1 ? 0.0123 : (index + 1) / 10000,
    }));
    const result = { attempts, cracked_combination: target, time_taken: 0.0123, success: true };
    await route.fulfill({
      contentType: 'text/event-stream',
      body:
        progress.map((step) => 'event: progress\ndata: ' + JSON.stringify(step) + '\n\n').join('') +
        'event: result\ndata: ' +
        JSON.stringify(result) +
        '\n\n',
    });
  });
}

test('all three algorithms expose explanations, Python files, timing, and accessible step playback', async ({
  page,
}) => {
  const requests: unknown[] = [];
  await mockDecoder(page, requests);
  await page.goto('/');
  await checkAccessibility(page, 'Briefing');
  await page.getByRole('button', { name: 'Enter the suite' }).click();
  await checkAccessibility(page, 'Suite');
  await page.getByRole('button', { name: 'Inspect the safe' }).click();
  await expect(page.getByRole('heading', { name: 'Acoustic decoder' })).toBeFocused();
  const methods = page.getByRole('group', { name: 'Search method' });
  await expect(methods.getByRole('button')).toHaveCount(3);

  for (const [algorithm, label, attempts] of [
    ['positional', 'Positional matching', '82'],
    ['backtracking', 'Backtracking', '235'],
    ['regression', 'Regression', '45'],
  ]) {
    await methods.getByRole('button', { name: label, exact: true }).click();
    await page.getByRole('button', { name: 'Use example', exact: true }).click();
    const sourceButton = page.getByRole('button', { name: 'Show algorithm' });
    await sourceButton.click();
    const dialog = page.getByRole('dialog', { name: label + ' · Python' });
    await expect(dialog.locator('.source-filename code')).toHaveText(
      'backend/' + algorithm + '.py',
    );
    await expect(dialog.locator('pre code')).toContainText('def sound_tool');
    await expect(dialog.locator('pre code')).toContainText('def crack_safe');
    await checkAccessibility(page, label + ' code dialog');
    await page.keyboard.press('Escape');
    await expect(sourceButton).toBeFocused();

    await page.getByRole('button', { name: 'Crack safe', exact: true }).click();
    await expect(page.getByText('Matches target')).toBeVisible();
    await expect(page.locator('.run-metrics dd').nth(0)).toHaveText(attempts);
    await expect(page.locator('.run-metrics dd').nth(1)).toContainText('0.0123');
    const replay = page.getByRole('region', { name: 'Step visualization' });
    await expect(replay.locator('.digit-grid li')).toHaveCount(10);
    await expect(replay.getByText(/Recorded execution/)).toBeVisible();
    await replay.getByRole('slider').press('End');
    if (algorithm === 'backtracking') {
      await expect(replay.getByText('Stage 2 · Try permutations', { exact: true })).toBeVisible();
      await expect(replay.locator('.digit-pool code')).toHaveText('0006666668');
    }
    if (algorithm === 'regression') {
      await expect(replay.getByText('Code inferred', { exact: true })).toBeVisible();
      await expect(replay.getByText(/without adding another scoring attempt/)).toBeVisible();
      await expect(replay.locator('.digit-fixed')).toHaveCount(10);
    }
    await replay.getByRole('button', { name: 'Play steps', exact: true }).click();
    await replay.getByRole('button', { name: 'Pause', exact: true }).click();
    await replay.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page.locator('.run-metrics dd').nth(0)).toHaveText(attempts);
    await checkAccessibility(page, label + ' visualization');
  }
  expect(requests).toEqual([
    { actual_combination: '0800666666', algorithm: 'positional' },
    { actual_combination: '0800666666', algorithm: 'backtracking' },
    { actual_combination: '9876543210', algorithm: 'regression' },
  ]);
});

test('regression explains its input constraint and Random supplies a valid permutation', async ({
  page,
}) => {
  const requests: unknown[] = [];
  await mockDecoder(page, requests);
  await page.goto('/');
  await page.getByRole('button', { name: 'Skip to decoder' }).click();
  await page.getByRole('button', { name: 'Regression', exact: true }).click();
  await page.getByRole('textbox', { name: 'Vault combination' }).fill('0000000000');
  await page.getByRole('button', { name: 'Crack safe' }).click();
  await expect(page.getByRole('alert')).toContainText('each digit 0–9 exactly once');
  expect(requests).toEqual([]);
  await checkAccessibility(page, 'Regression input error');
  await page.getByRole('button', { name: 'Random', exact: true }).click();
  await expect
    .poll(
      async () =>
        new Set(await page.getByRole('textbox', { name: 'Vault combination' }).inputValue()).size,
    )
    .toBe(10);
  const value = await page.getByRole('textbox', { name: 'Vault combination' }).inputValue();
  expect(value).toMatch(/^[0-9]{10}$/);
  expect(new Set(value).size).toBe(10);
});

test('typing and paste preserve leading zeros and cap the input at ten digits', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  await page.getByRole('button', { name: 'Skip to decoder' }).click();
  const combination = page.getByRole('textbox', { name: 'Vault combination' });
  await combination.fill('');
  await combination.pressSequentially('0a8-0');
  await expect(combination).toHaveValue('080');
  await combination.pressSequentially('0666666999');
  await expect(combination).toHaveValue('0800666666');
  await combination.press('End');
  expect(await combination.evaluate((input) => input.scrollLeft)).toBe(0);
  await page.evaluate(() => navigator.clipboard.writeText('0a8０0 0-666666-777'));
  await combination.press('ControlOrMeta+A');
  await combination.press('ControlOrMeta+V');
  await expect(combination).toHaveValue('0800666666');
});

test('all three search methods and step visualization fit phone and tablet widths', async ({
  page,
}) => {
  await mockDecoder(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Skip to decoder' }).click();
  const methods = page.getByRole('group', { name: 'Search method' });
  await methods.getByRole('button', { name: 'Regression', exact: true }).click();
  await page.getByRole('button', { name: 'Use example', exact: true }).click();
  await page.getByRole('button', { name: 'Crack safe' }).click();
  await expect(page.getByRole('region', { name: 'Step visualization' })).toBeVisible();
  for (const width of [320, 641, 719]) {
    await page.setViewportSize({ width, height: 820 });
    const fits = await methods.evaluate((group) => {
      const bounds = group.getBoundingClientRect();
      return Array.from(group.querySelectorAll('button')).every((button) => {
        const rect = button.getBoundingClientRect();
        return (
          rect.left >= bounds.left &&
          rect.right <= bounds.right + 1 &&
          button.scrollWidth <= button.clientWidth + 1
        );
      });
    });
    expect(fits, 'Search methods fit at ' + width + 'px').toBe(true);
    const noOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    );
    expect(noOverflow, 'Page fits at ' + width + 'px').toBe(true);
    const grid = page.locator('.digit-grid');
    expect(await grid.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  }
});
