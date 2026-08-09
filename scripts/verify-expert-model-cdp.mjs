// L3: CDP 验证模型配置 UI（最终版）
// 用法：node scripts/verify-expert-model-cdp.mjs

import puppeteer from 'puppeteer-core';
import { writeFileSync } from 'fs';

const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
const page = (await b.pages()).find(p => p.url().includes('5173'));
if (!page) { console.log('❌ No Vite page'); process.exit(1); }
await page.bringToFront();
await new Promise(r => setTimeout(r, 1500));

let P = 0, F = 0;
function check(n, ok, d = '') {
  if (ok) { P++; console.log('  ✅ ' + n + (d ? ' - ' + d : '')); }
  else { F++; console.log('  ❌ ' + n + (d ? ' - ' + d : '')); }
}

console.log('\n🔍 L3 Expert Model Config\n');

// ═══════ L2 IPC ═══════
console.log('── IPC Tests ──');

const [cm, lm] = await page.evaluate(() =>
  Promise.all([
    window.electronAPI.invoke('model-config:list').catch(() => []),
    window.electronAPI.invoke('model-config-local:list').catch(() => []),
  ])
);
const models = [...(Array.isArray(cm)?cm:[]), ...(Array.isArray(lm)?lm:[])];
check('Model list', models.length > 0, `${models.length} models`);

const exps = await page.evaluate(() => window.electronAPI.invoke('expert:list').catch(() => []));
const expArr = Array.isArray(exps) ? exps : [];
check('Expert list', expArr.length > 0, `${expArr.length} experts`);

if (models.length > 0 && expArr.length > 0) {
  const tgt = expArr[0];
  const mdl = models[0];
  
  // Bind
  await page.evaluate(({e,m}) => {
    const u = {...e, bindings: {...(e.bindings||{}), modelId: m}};
    return window.electronAPI.invoke('expert:update', u).catch(() => {});
  }, {e: tgt, m: mdl.id});
  
  // Verify
  const v = await page.evaluate(({id,m}) =>
    window.electronAPI.invoke('expert:list').then(l =>
      (Array.isArray(l)?l:[]).find(e=>e.id===id)?.bindings?.modelId === m
    ).catch(()=>false)
  , {id: tgt.id, m: mdl.id});
  check(`Bind + persist (${tgt.name} ← ${mdl.name})`, v);
  
  // Cleanup
  await page.evaluate(({e}) => {
    const u = {...e, bindings: {...(e.bindings||{})}};
    delete u.bindings.modelId;
    return window.electronAPI.invoke('expert:update', u).catch(()=>{});
  }, {e: tgt});
}

// ═══════ L3 CDP UI ═══════
console.log('\n── CDP UI ──');

// Navigate: click "专家·技能·连接器" (opens dropdown) → click "专家中心" in dropdown
await page.evaluate(() => {
  const btns = Array.from(document.querySelectorAll('button'));
  const pluginBtn = btns.find(b => (b.textContent||'').trim()==='专家·技能·连接器');
  if (pluginBtn) pluginBtn.click();
});
await new Promise(r => setTimeout(r, 1500));

// Click "专家中心" in dropdown
await page.evaluate(() => {
  // Dropdown uses SubMenuItem with text "专家中心"
  const all = Array.from(document.querySelectorAll('button'));
  const expertBtn = all.find(b => (b.textContent||'').trim()==='专家中心');
  if (expertBtn) expertBtn.click();
});
await new Promise(r => setTimeout(r, 4000));

// Verify ExpertCenter
const ec = await page.evaluate(() => {
  const text = document.body.textContent || '';
  const btns = Array.from(document.querySelectorAll('button')).filter(b => b.offsetParent);
  const btnTexts = btns.map(b => (b.textContent||'').trim().slice(0,30));
  return {
    isEC: btnTexts.some(t => t==='管理 SOP' || t==='管理 Skill' || t==='管理 MCP'),
    editBtns: btnTexts.filter(t => t==='编辑').length,
    sample: btnTexts.slice(0, 20),
  };
});
check('ExpertCenter loaded', ec.isEC || ec.editBtns > 0);
console.log(`  Edit btns: ${ec.editBtns}, Sample: ${JSON.stringify(ec.sample.slice(5,15))}`);

// Open editor
if (ec.editBtns > 0) {
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const edit = btns.find(b => b.textContent === '编辑');
    if (edit) edit.click();
  });
  await new Promise(r => setTimeout(r, 3000));

  const dlg = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"][aria-modal="true"]');
    if (!d) return {open:false};
    const t = d.textContent || '';
    return {
      open: true,
      hasModel: t.includes('模型'),
      tabs: Array.from(d.querySelectorAll('button')).filter(b => b.offsetParent).map(b => (b.textContent||'').trim()).filter(x => x.length<20),
    };
  });
  
  if (dlg.open) {
    check('Editor opened', true);
    check('Model tab exists', dlg.hasModel);
    console.log('  Tabs: ' + JSON.stringify(dlg.tabs));
    
    if (dlg.hasModel) {
      // Click model tab
      await page.evaluate(() => {
        const d = document.querySelector('[role="dialog"][aria-modal="true"]');
        const btns = Array.from(d.querySelectorAll('button'));
        const mt = btns.find(b => (b.textContent||'').trim()==='模型');
        if (mt) mt.click();
      });
      await new Promise(r => setTimeout(r, 2000));

      const mt = await page.evaluate(() => {
        const d = document.querySelector('[role="dialog"][aria-modal="true"]');
        const t = d ? d.textContent||'' : '';
        const rows = Array.from(d?d.querySelectorAll('[role="button"]'):[]).filter(r =>
          (r.getAttribute('aria-label')||'').includes('选择模型')
        );
        return {
          guide: t.includes('为此专家选择一个固定')||t.includes('专家专属'),
          local: t.includes('本机模型'),
          cloud: t.includes('云端模型'),
          rows: rows.length,
          noModel: t.includes('暂无可用模型'),
        };
      });
      check('Model guide text', mt.guide);
      check('本机/云端 groups', mt.local || mt.cloud);
      check('Rows or empty state', mt.rows > 0 || mt.noModel, mt.rows?`${mt.rows} rows`:'empty');
      
      const ss = await page.screenshot({encoding:'base64', type:'png'});
      writeFileSync('l3-model-tab.png', Buffer.from(ss, 'base64'));
      console.log('  📸 l3-model-tab.png');
    }
    
    // Close
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const c = btns.find(b => (b.textContent||'').trim()==='取消');
      if (c) c.click();
    });
    await new Promise(r => setTimeout(r, 1000));
  } else {
    console.log('  ⚠️ Editor dialog not found');
  }
} else {
  console.log('  ⚠️ No edit buttons - ExpertCenter may not be fully loaded');
}

console.log('\n📊 Pass: ' + P + ' | Fail: ' + F + '\n');
if (F > 0) process.exit(1);
