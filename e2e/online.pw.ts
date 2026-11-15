import { test, expect } from '@playwright/test';

test('configured Classic: isolated guests invite, ready, play, reload and agree rematch',async({browser,baseURL})=>{
  test.skip(process.env.RUN_HOSTED_E2E!=='1','Requires migrated Supabase, anonymous auth and explicit RUN_HOSTED_E2E=1.');
  const a=await browser.newContext();const b=await browser.newContext();
  try{
    const x=await a.newPage();const o=await b.newPage();const suffix=Date.now().toString(36).slice(-7);
    await x.goto(baseURL!);await o.goto(baseURL!);
    await x.getByRole('textbox',{name:'Player Name',exact:true}).fill(`GuestA-${suffix}`);
    await o.getByRole('textbox',{name:'Player Name',exact:true}).fill(`GuestB-${suffix}`);
    await x.getByRole('button',{name:'Classic Room',exact:true}).click();
    const code=await x.getByTestId('room-invite-code').innerText();
    await o.getByRole('textbox',{name:'Join with Invite Code',exact:true}).fill(code);await o.getByRole('button',{name:'Join',exact:true}).click();
    await expect(x.getByText(`GuestB-${suffix} (O)`,{exact:false})).toBeVisible();
    await x.getByRole('button',{name:'Ready Up',exact:true}).click();
    await expect(o.getByText(`GuestA-${suffix} (X)`,{exact:false})).toContainText('Ready');
    await o.getByRole('button',{name:'Ready Up',exact:true}).click();
    for(const [cell,player] of [[0,x],[3,o],[1,x],[4,o],[2,x]] as const){
      await player.getByTestId(`board-cell-${cell}`).click();
      await expect(x.getByTestId(`board-cell-${cell}`)).not.toHaveAttribute('data-cell-value','empty');
      await expect(o.getByTestId(`board-cell-${cell}`)).not.toHaveAttribute('data-cell-value','empty');
    }
    await expect(x.getByRole('dialog')).toBeVisible();await o.reload();await expect(o.getByRole('dialog')).toBeVisible();
    await x.getByRole('dialog').getByRole('button',{name:'Request Rematch',exact:true}).click();
    await expect(o.getByRole('status')).toContainText('Rematch votes: 1/2');
    await o.getByRole('dialog').getByRole('button',{name:'Request Rematch',exact:true}).click();
    await expect(x.getByTestId('board-cell-0')).toHaveAttribute('data-cell-value','empty',{timeout:10000});
    await expect(o.getByTestId('board-cell-0')).toHaveAttribute('data-cell-value','empty',{timeout:10000});
  }finally{await a.close();await b.close();}
});

test('guest can register with simple password 12345678, view progress, log out and log back in', async ({ page }) => {
  test.skip(
    !process.env.RUN_HOSTED_E2E || Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY),
    'Hosted account E2E runs against staging without Turnstile'
  );
  const username = `E2e_${Date.now().toString(36).slice(-5)}${Math.random().toString(36).slice(2, 5)}`;

  await page.goto('/');
  await expect(page.getByText('Create an account to save progress and join public rankings')).toBeVisible();

  await page.getByRole('button', { name: 'Register' }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.locator('#auth-username').fill(username);
  await dialog.locator('#auth-password').fill('12345678');
  await dialog.locator('button[type="submit"]').click();

  const profileBtn = page.getByRole('button', { name: username });
  await expect(profileBtn).toBeVisible({ timeout: 15000 });
  const lobbyLeaderboard = page.getByRole('checkbox', { name: /Show my name and avatar in public casual rankings/i });
  await expect(lobbyLeaderboard).toBeVisible();
  await Promise.all([
    page.waitForResponse((res) => res.url().endsWith('/api/profile') && res.request().method() === 'PUT' && res.status() === 200),
    lobbyLeaderboard.check(),
  ]);
  await expect(lobbyLeaderboard).toBeChecked();

  await profileBtn.click();
  const progress = page.getByRole('dialog', { name: 'Player Progress' });
  await expect(progress).toBeVisible();
  await expect(progress.getByText(username)).toBeVisible();
  await expect(progress.getByText('Visible in public casual rankings')).toBeVisible();
  await expect(progress.getByText('0-0-0').first()).toBeVisible();
  await progress.getByRole('button', { name: 'Close progress' }).click();

  await page.getByRole('button', { name: 'Log Out' }).click();
  await expect(page.getByRole('button', { name: 'Log In' }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Log In' }).first().click();
  const loginDialog = page.getByRole('dialog');
  await loginDialog.locator('#auth-username').fill(username);
  await loginDialog.locator('#auth-password').fill('12345678');
  await loginDialog.locator('button[type="submit"]').click();

  await expect(page.getByRole('button', { name: username })).toBeVisible({ timeout: 15000 });
  await page.reload();
  await expect(page.getByRole('button', { name: username })).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('checkbox', { name: /Show my name and avatar in public casual rankings/i })).toBeChecked();
});
