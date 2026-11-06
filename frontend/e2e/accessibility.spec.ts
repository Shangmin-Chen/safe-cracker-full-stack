import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

async function checkAccessibility(page: Page, scene: string): Promise<void> {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(violations, scene).toEqual([]);
}

test('story, decoder, source dialog, and debrief pass the automated accessibility checks', async ({
  page,
}) => {
  await page.route('**/api/crack_safe/**', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        json: {
          algorithm: 'backtracking',
          source: 'def crack_backtracking_attempts(port):\n    yield from search(port)\n',
        },
      });
      return;
    }
    const progress = { attempts: 1, current_combination: '0000000000', time_taken: 0.01 };
    const result = {
      attempts: 1,
      cracked_combination: '0000000000',
      time_taken: 0.01,
      success: true,
    };
    await route.fulfill({
      contentType: 'text/event-stream',
      body: `event: progress\ndata: ${JSON.stringify(progress)}\n\nevent: result\ndata: ${JSON.stringify(result)}\n\n`,
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

  await page.getByText('Backtracking', { exact: true }).click();
  const showAlgorithm = page.getByRole('button', { name: 'Show algorithm' });
  await showAlgorithm.click();
  const dialog = page.getByRole('dialog', { name: 'Backtracking · Python' });
  await expect(dialog.locator('pre code')).toContainText('def crack_backtracking_attempts');
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
  await expect(page.getByText('Matches target')).toBeVisible();
  await page.getByRole('button', { name: 'Replay the decode' }).click();
  await expect(page.getByText('Step 1 of 1')).toBeVisible();
  await checkAccessibility(page, 'Replay');
  await page.getByRole('button', { name: 'Recover the dossier' }).click();
  await expect(page.getByRole('heading', { name: 'Dossier recovered.' })).toBeFocused();
  await checkAccessibility(page, 'Debrief');
  await page.getByRole('button', { name: 'Try the other method' }).click();
  const comparison = page.getByRole('table', { name: 'Method comparison' });
  await expect(comparison.getByRole('columnheader', { name: 'Positional matching' })).toBeVisible();
  await expect(comparison.getByRole('columnheader', { name: 'Backtracking' })).toBeVisible();
  await checkAccessibility(page, 'Comparison debrief');
});

test('the combination field filters typing and paste while preserving leading zeros', async ({
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

  await page.evaluate(() => navigator.clipboard.writeText('0a8０0 0-666666'));
  await combination.press('ControlOrMeta+A');
  await combination.press('ControlOrMeta+V');
  await expect(combination).toHaveValue('0800666666');
});

test('both method buttons fit at narrow phone and tablet widths', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Skip to decoder' }).click();
  const method = page.getByRole('group', { name: 'Search method' });
  await expect(method.getByRole('button')).toHaveCount(2);

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
  }
});
