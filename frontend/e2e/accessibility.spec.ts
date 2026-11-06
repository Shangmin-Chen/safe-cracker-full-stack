import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

async function checkAccessibility(page: Page, scene: string): Promise<void> {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(violations, scene).toEqual([]);
}

test('story, decoder, source dialog, and automatic replay pass the automated accessibility checks', async ({
  page,
}) => {
  const requests: unknown[] = [];
  let releaseBacktracking!: () => void;
  const backtrackingReady = new Promise<void>((resolve) => {
    releaseBacktracking = resolve;
  });
  await page.route('**/api/crack_safe/**', async (route) => {
    if (route.request().method() === 'GET') {
      const algorithm = new URL(route.request().url()).pathname.split('/').at(-2);
      await route.fulfill({
        json: {
          algorithm,
          source: `def crack_${algorithm}_attempts(port):\n    yield from search(port)\n`,
        },
      });
      return;
    }
    const request = route.request().postDataJSON();
    requests.push(request);
    const attempts = request.algorithm === 'positional' ? 2 : 3;
    if (request.algorithm === 'backtracking') await backtrackingReady;
    const target = '0000000000';
    const probes = Array.from({ length: attempts }, (_, index) => ({
      attempts: index + 1,
      current_combination: index === attempts - 1 ? target : String(index + attempts).repeat(10),
      time_taken: 0.01,
    }));
    const result = { attempts, cracked_combination: target, time_taken: 0.01, success: true };
    await route.fulfill({
      contentType: 'text/event-stream',
      body:
        probes.map((probe) => `event: progress\ndata: ${JSON.stringify(probe)}\n\n`).join('') +
        `event: result\ndata: ${JSON.stringify(result)}\n\n`,
    });
  });

  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Enter the suite' })).toBeVisible();
  await checkAccessibility(page, 'Briefing');
  await page.getByRole('button', { name: 'Enter the suite' }).click();
  await checkAccessibility(page, 'Suite');
  await page.getByRole('button', { name: 'Inspect the safe' }).click();
  await expect(page.getByRole('heading', { name: 'Acoustic decoder' })).toBeFocused();
  await checkAccessibility(page, 'Decoder');

  await page.getByRole('button', { name: 'Both', exact: true }).click();
  const showAlgorithm = page.getByRole('button', { name: 'Show algorithm' });
  await showAlgorithm.click();
  const dialog = page.getByRole('dialog', { name: 'Both · Python' });
  await expect(dialog.locator('pre code')).toHaveText([
    /def crack_positional_attempts/,
    /def crack_backtracking_attempts/,
  ]);
  await expect(dialog.getByText(/counting repeats regardless of position/)).toBeVisible();
  await checkAccessibility(page, 'Algorithm dialog');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(showAlgorithm).toBeFocused();

  const combination = page.getByRole('textbox', { name: 'Vault combination' });
  await combination.fill('12');
  await page.getByRole('button', { name: 'Crack safe' }).click();
  await expect(page.getByRole('alert')).toContainText('Enter exactly 10 digits');
  await checkAccessibility(page, 'Invalid combination');
  await combination.fill('0000000000');
  await page.getByRole('button', { name: 'Crack safe' }).click();
  const positionalBar = page.getByRole('progressbar', { name: 'Positional matching progress' });
  const backtrackingBar = page.getByRole('progressbar', { name: 'Backtracking progress' });
  await expect(positionalBar).toHaveAttribute('aria-valuenow', '100');
  await expect(
    page.getByRole('group', { name: 'Backtracking', exact: true }).getByText('Live'),
  ).toBeVisible();
  await expect(backtrackingBar).not.toHaveAttribute('aria-valuenow', /./);
  releaseBacktracking();
  await expect(backtrackingBar).toHaveAttribute('aria-valuenow', '100');
  await expect(page.getByText('Matches target')).toBeVisible();
  expect(requests).toEqual([
    { actual_combination: '0000000000', algorithm: 'positional' },
    { actual_combination: '0000000000', algorithm: 'backtracking' },
  ]);
  const comparison = page.getByRole('region', { name: 'Method comparison' });
  for (const method of ['Positional matching', 'Backtracking']) {
    await expect(
      comparison.getByRole('group', { name: method }).getByText('0000000000'),
    ).toBeVisible();
  }

  const replay = page.getByRole('region', { name: 'Decoder replay' });
  const positionalSlider = replay.getByRole('slider', { name: 'Positional matching replay step' });
  await expect(replay.getByText('Step 1 of 2')).toBeVisible();
  await positionalSlider.press('End');
  await expect(replay.getByText('Step 2 of 2')).toBeVisible();

  await replay.getByRole('button', { name: 'Backtracking' }).click();
  await expect(replay.getByText('Step 1 of 3')).toBeVisible();
  await expect(replay.getByText('3333333333')).toBeVisible();
  const backtrackingSlider = replay.getByRole('slider', { name: 'Backtracking replay step' });
  await backtrackingSlider.press('End');
  await expect(replay.getByText('Step 3 of 3')).toBeVisible();
  await expect(replay.getByText('0000000000')).toBeVisible();
  await replay.getByRole('button', { name: 'Previous' }).click();
  await expect(backtrackingSlider).toHaveValue('2');
  await expect(replay.getByText('4444444444')).toBeVisible();

  await replay.getByRole('button', { name: 'Positional matching' }).click();
  await expect(positionalSlider).toHaveValue('2');
  await checkAccessibility(page, 'Comparison and replay');
});

test('the combination field caps typing and paste at ten digits and preserves leading zeros', async ({
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

test('method buttons and dual telemetry fit at narrow phone and tablet widths', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Skip to decoder' }).click();
  const method = page.getByRole('group', { name: 'Search method' });
  await expect(method.getByRole('button')).toHaveCount(3);
  await method.getByRole('button', { name: 'Both' }).click();
  const positional = page.getByRole('progressbar', { name: 'Positional matching progress' });
  const backtracking = page.getByRole('progressbar', { name: 'Backtracking progress' });

  for (const width of [320, 641, 719]) {
    await page.setViewportSize({ width, height: 820 });
    const fits = await method.evaluate((group) => {
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
    expect(fits, `Search method fits at ${width}px`).toBe(true);
    const left = (await positional.boundingBox())!;
    const right = (await backtracking.boundingBox())!;
    expect(left.x + left.width).toBeLessThan(right.x);
    expect(left.y).toBeCloseTo(right.y, 0);
  }
});
