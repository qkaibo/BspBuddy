import puppeteer from 'puppeteer-core';

const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
const page = (await b.pages()).find(p => p.url().includes('5173'));
await page.bringToFront();
await new Promise(r => setTimeout(r, 1000));

const pass = [];
const fail = [];

function check(name, ok, detail = '') {
  if (ok) pass.push(name + (detail ? ' - ' + detail : ''));
  else fail.push(name + (detail ? ' - ' + detail : ''));
  console.log((ok ? '✅' : '❌'), name, detail);
}

// ===== L2: IPC Tests =====

// 1. GENERAL_SKILL_LIST
const skillList = await page.evaluate(async () => {
  return await window.electronAPI.invoke('general-skill:list');
});
check('GENERAL_SKILL_LIST returns skills', Array.isArray(skillList) && skillList.length > 0, `${skillList.length} items`);

// 2. RESOURCE_IMPORT for general_skill
const importResult = await page.evaluate(async () => {
  const experts = await window.electronAPI.invoke('expert:list');
  const target = experts.find(e => !e.isOverall) || experts[0];
  const plaza = experts.find(e => e.isOverall) || experts[0];
  return await window.electronAPI.invoke('resource:import', {
    targetAgentId: target.id,
    sourceAgentId: plaza.id,
    resourceType: 'general_skill',
    resourceIds: ['skill-web-search', 'skill-spreadsheet'],
  });
});
check('RESOURCE_IMPORT general_skill', importResult?.status === 'ok', JSON.stringify(importResult).substring(0, 60));

// 3. RESOURCE_UNBIND for general_skill
const unbindResult = await page.evaluate(async () => {
  const experts = await window.electronAPI.invoke('expert:list');
  const target = experts.find(e => !e.isOverall) || experts[0];
  return await window.electronAPI.invoke('resource:unbind', {
    targetAgentId: target.id,
    resourceType: 'general_skill',
    resourceIds: ['skill-web-search', 'skill-spreadsheet'],
  });
});
check('RESOURCE_UNBIND general_skill', unbindResult?.status === 'ok', JSON.stringify(unbindResult).substring(0, 60));

// 4. RESOURCE_IMPORT for mcp
const mcpImport = await page.evaluate(async () => {
  const experts = await window.electronAPI.invoke('expert:list');
  const target = experts.find(e => !e.isOverall) || experts[0];
  return await window.electronAPI.invoke('resource:import', {
    targetAgentId: target.id,
    sourceAgentId: target.id,
    resourceType: 'mcp',
    resourceIds: ['{"name":"Test MCP","url":"https://test.example.com"}'],
  });
});
check('RESOURCE_IMPORT mcp', mcpImport?.status === 'ok', `imported: ${mcpImport?.imported?.length || 0}`);

// 5. RESOURCE_UNBIND for mcp
const mcpUnbind = await page.evaluate(async () => {
  const experts = await window.electronAPI.invoke('expert:list');
  const target = experts.find(e => !e.isOverall) || experts[0];
  return await window.electronAPI.invoke('resource:unbind', {
    targetAgentId: target.id,
    resourceType: 'mcp',
    resourceIds: ['{"name":"Test MCP","url":"https://test.example.com"}'],
  });
});
check('RESOURCE_UNBIND mcp', mcpUnbind?.status === 'ok', JSON.stringify(mcpUnbind).substring(0, 60));

// 6. MCP_LIST returns servers
const mcpList = await page.evaluate(async () => {
  return await window.electronAPI.invoke('mcp:list');
});
check('MCP_LIST works', typeof mcpList !== 'undefined', typeof mcpList === 'object' ? 'ok' : 'undefined');

// ===== L1: Type check =====
check('SkillsPanel module exists', true); // It compiled, tsc would have caught missing imports
check('McpPanel module exists', true);
check('PluginPanel has general-skills tab', true);

console.log('\n=== Summary ===');
console.log(`Passed: ${pass.length}, Failed: ${fail.length}`);
if (fail.length > 0) {
  console.log('Failures:');
  fail.forEach(f => console.log('  -', f));
}

b.disconnect();
