// generate-dashboard-data.js
// Run locally before deploy to generate real dashboard data
// Usage: node generate-dashboard-data.js

const fs = require('fs');
const path = require('path');

async function generateData() {
  const data = {
    generatedAt: new Date().toISOString(),
    agents: [],
    cronJobs: [],
    projects: [],
    sites: [],
    system: {},
    openclaw: {}
  };

  // 1. Agents from config
  try {
    const configRaw = fs.readFileSync(
      path.join(process.env.HOME, '.openclaw/openclaw.json'), 'utf8'
    );
    const config = JSON.parse(configRaw);
    
    const agentList = config.agents?.list || [];
    const modelProviders = config.models?.providers || {};
    
    data.agents = agentList.map(a => {
      // Resolve model display name
      let modelDisplay = a.model || 'unknown';
      const [provider, modelId] = modelDisplay.split('/');
      if (modelProviders[provider]) {
        const modelDef = modelProviders[provider].models?.find(m => m.id === modelId);
        if (modelDef) modelDisplay = modelDef.name || modelDisplay;
      }
      
      return {
        id: a.id,
        name: a.name,
        model: modelDisplay,
        role: a.identity?.name || '',
        provider: provider
      };
    });

    // OpenClaw info
    data.openclaw = {
      port: config.gateway?.port || 18789,
      mode: config.gateway?.mode || 'local',
      timezone: 'Asia/Taipei',
      nodeVersion: process.version,
      agentCount: agentList.length,
      channels: Object.keys(config.channels || {}),
      telegramGroups: Object.keys(
        config.channels?.telegram?.accounts?.[Object.keys(config.channels?.telegram?.accounts || {})[0]]?.groups || {}
      ).length
    };
  } catch (e) {
    console.error('Failed to read OpenClaw config:', e.message);
  }

  // 2. Cron jobs - read from snapshot file (updated by update-cron-snapshot.js)
  try {
    const cronPath = path.join(__dirname, 'cron-snapshot.json');
    if (fs.existsSync(cronPath)) {
      const cronRaw = fs.readFileSync(cronPath, 'utf8');
      data.cronJobs = JSON.parse(cronRaw);
    }
  } catch (e) {
    console.error('Failed to read cron snapshot:', e.message);
  }

  // 3. Projects from projects.json
  try {
    const projRaw = fs.readFileSync(
      path.join(__dirname, 'public/projects.json'), 'utf8'
    );
    const projConfig = JSON.parse(projRaw);
    data.projects = projConfig.projects || [];
    data.sites = (projConfig.projects || [])
      .filter(p => p.url && p.url.length > 0)
      .map(p => ({ name: p.name, url: p.url, status: p.status }));
  } catch (e) {
    console.error('Failed to read projects.json:', e.message);
  }

  // 4. System info
  try {
    const si = require('systeminformation');
    const [cpu, mem, osInfo] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.osInfo()
    ]);
    data.system = {
      cpu: cpu.currentLoad.toFixed(1),
      memoryUsedGB: (mem.used / (1024*1024*1024)).toFixed(1),
      memoryTotalGB: (mem.total / (1024*1024*1024)).toFixed(1),
      memoryPercent: ((mem.used / mem.total) * 100).toFixed(1),
      os: osInfo.distro + ' ' + osInfo.release,
      hostname: osInfo.hostname,
      platform: osInfo.platform
    };
  } catch (e) {
    console.error('System info unavailable:', e.message);
  }

  // 5. Gemini API usage
  try {
    const usagePath = path.join(process.env.HOME, '.openclaw/workspace/seo-blog-next/scripts/gemini-usage.json');
    if (fs.existsSync(usagePath)) {
      const usageRaw = fs.readFileSync(usagePath, 'utf8');
      const usageData = JSON.parse(usageRaw);
      const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });
      data.geminiUsage = {
        today: usageData.daily?.[today] || { total_requests: 0, image_requests: 0, text_requests: 0, errors: 0 },
        limits: { rpd: 500, image_rpd: 50, rpm: 15 },
        history: Object.fromEntries(
          Object.entries(usageData.daily || {}).sort().slice(-7)
        )
      };
    }
  } catch (e) {
    console.error('Failed to read Gemini usage:', e.message);
  }

  // Write output
  const outPath = path.join(__dirname, 'public/dashboard-data.json');
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2));
  console.log('✅ Dashboard data generated:', outPath);
  console.log(`   Agents: ${data.agents.length}`);
  console.log(`   Cron Jobs: ${data.cronJobs.length}`);
  console.log(`   Projects: ${data.projects.length}`);
  console.log(`   Sites: ${data.sites.length}`);
}

function getGatewayToken() {
  try {
    const configRaw = fs.readFileSync(
      path.join(process.env.HOME, '.openclaw/openclaw.json'), 'utf8'
    );
    const config = JSON.parse(configRaw);
    return config.gateway?.auth?.token || '';
  } catch {
    return '';
  }
}

generateData().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
