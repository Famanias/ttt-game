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
    await x.getByRole('button',{name:'Ready Up',exact:true}).click();await o.getByRole('button',{name:'Ready Up',exact:true}).click();
    for(const [cell,player] of [[0,x],[3,o],[1,x],[4,o],[2,x]] as const){
      await player.getByTestId(`board-cell-${cell}`).click();
      await expect(x.getByTestId(`board-cell-${cell}`)).not.toHaveAttribute('data-cell-value','empty');
      await expect(o.getByTestId(`board-cell-${cell}`)).not.toHaveAttribute('data-cell-value','empty');
    }
    await expect(x.getByRole('dialog')).toBeVisible();await o.reload();await expect(o.getByRole('dialog')).toBeVisible();
    await x.getByRole('dialog').getByRole('button',{name:'Request Rematch',exact:true}).click();
    await o.getByRole('dialog').getByRole('button',{name:'Request Rematch',exact:true}).click();
    await expect(x.getByTestId('board-cell-0')).toHaveAttribute('data-cell-value','empty');
    await expect(o.getByTestId('board-cell-0')).toHaveAttribute('data-cell-value','empty');
  }finally{await a.close();await b.close();}
});
