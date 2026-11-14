import { test, expect } from '@playwright/test';

test('offline local Classic alternates, locks terminal board and resets',async({page},info)=>{
  await page.route('**/api/**',route=>route.abort());
  await page.goto('/');
  await page.getByRole('button',{name:'Local 2P',exact:true}).click();
  await page.getByRole('button',{name:'Play Classic',exact:true}).click();
  for(const [index,mark] of [[0,'X'],[3,'O'],[1,'X'],[4,'O'],[2,'X']] as const){
    const cell=page.getByTestId(`board-cell-${index}`);
    if(info.project.name==='mobile')await cell.tap();else await cell.click();
    await expect(cell).toHaveAttribute('data-cell-value',mark);
    await expect(cell).toBeDisabled();
  }
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByTestId('board-cell-8')).toBeDisabled();
  await page.getByRole('button',{name:'Play Again',exact:true}).click();
  await expect(page.getByTestId('board-cell-0')).toHaveAttribute('data-cell-value','empty');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});

test('unconfigured online and leaderboard show honest errors without blocking local games',async({page})=>{
  test.skip(!!process.env.NEXT_PUBLIC_SUPABASE_URL,'This case requires the unconfigured setup.');
  await page.goto('/');
  await page.getByRole('button',{name:'Classic Room',exact:true}).click();
  await expect(page.getByText('Online play is not configured. Local games are available.')).toBeVisible();
  await page.getByRole('button',{name:'Leaderboard',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Casual Rankings'})).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Online play is not configured');
});

test('local Perfect Timing keeps its one-stop pass-and-play flow',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Local 2P',exact:true}).click();
  await page.getByRole('button',{name:'Perfect Timing Perfect Timing',exact:true}).click();
  await page.getByRole('button',{name:'Play Clash',exact:true}).click();
  await page.getByRole('button',{name:'Lock In Timing',exact:true}).click();
  await page.getByRole('button',{name:'Ready for Player O',exact:true}).click();
  await page.getByRole('button',{name:'Lock In Timing',exact:true}).click();
  await expect(page.getByRole('button',{name:/Place on Board|Replay Clash/})).toBeVisible();
});

test('local Flash Memory reveals actual tiles and scores both players',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Local 2P',exact:true}).click();
  await page.getByRole('button',{name:'Flash Memory Flash Memory',exact:true}).click();await page.getByRole('button',{name:'Play Clash',exact:true}).click();
  for(let player=0;player<2;player++){
    if(player===1)await page.getByRole('button',{name:'Ready for Player O',exact:true}).click();
    const tiles=page.getByRole('button',{name:/Memory tile/});await expect(tiles).toHaveCount(9);
    const pattern=await tiles.evaluateAll(elements=>elements.flatMap((e,i)=>e.className.includes('bg-[#8B7CFF]')?[i]:[]));
    expect(pattern).toHaveLength(3);await expect(tiles.first()).toBeEnabled();
    for(const index of pattern)await tiles.nth(index).click();
    await page.getByRole('button',{name:'Submit Recall',exact:true}).click();
  }
  await expect(page.getByRole('button',{name:/Place on Board|Replay Clash/})).toBeVisible();
});

test('local Target Rush accepts real hits and ends each timed attempt',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Local 2P',exact:true}).click();
  await page.getByRole('button',{name:'Target Rush Target Rush',exact:true}).click();await page.getByRole('button',{name:'Play Clash',exact:true}).click();
  for(let player=0;player<2;player++){
    if(player===1)await page.getByRole('button',{name:'Ready for Player O',exact:true}).click();
    await page.getByRole('button',{name:/^(Target|Bonus gold target)$/}).last().click();
    await expect(page.getByText(/Score (90|140)/)).toBeVisible();
    if(player===0)await expect(page.getByRole('button',{name:'Ready for Player O',exact:true})).toBeVisible({timeout:8000});
  }
  await expect(page.getByRole('button',{name:/Place on Board|Replay Clash/})).toBeVisible({timeout:8000});
});

for(const difficulty of ['Casual','Tactical','Master'])test(`local ${difficulty} bot makes a legal reply`,async({page})=>{
  await page.route('**/api/**',route=>route.abort());await page.goto('/');
  await page.getByRole('button',{name:new RegExp(`^${difficulty}$`,'i')}).click();await page.getByRole('button',{name:'Play Classic',exact:true}).click();
  await page.getByTestId('board-cell-0').click();
  await expect(page.locator('[data-cell-value="O"]')).toHaveCount(1);
  await expect(page.getByTestId('board-cell-0')).toHaveAttribute('data-cell-value','X');
});

test('offline local draw reaches a terminal result',async({page})=>{
  await page.route('**/api/**',route=>route.abort());await page.goto('/');await page.getByRole('button',{name:'Local 2P',exact:true}).click();await page.getByRole('button',{name:'Play Classic',exact:true}).click();
  for(const index of [0,1,2,4,3,5,7,6,8])await page.getByTestId(`board-cell-${index}`).click();
  await expect(page.getByTestId('outcome-heading')).toHaveText('Balanced Draw');
  await expect(page.locator('[data-cell-value="empty"]')).toHaveCount(0);
});

test('selected avatar, display name and sound setting survive entering the arena',async({page})=>{
  await page.goto('/');await page.getByRole('textbox',{name:'Player Name',exact:true}).fill('LocalStar');
  await page.getByRole('button',{name:'Select avatar Comet Mask',exact:true}).click();await page.getByRole('button',{name:'Mute audio',exact:true}).click();
  await page.getByRole('button',{name:'Play Classic',exact:true}).click();
  await expect(page.locator('img[src$="08f-avatar-comet-mask.png"]')).toBeVisible();
  await expect(page.getByText('LocalStar',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Unmute sound',exact:true})).toBeVisible();
});
