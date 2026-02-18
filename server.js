const express = require('express');
const si = require('systeminformation');
const cors = require('cors');
const http = require('http');

const app = express();
const PORT = 3002;
const path = require('path');

app.use(cors());
app.use(express.json());

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// System status cache
let systemCache = {
  cpu: null,
  memory: null,
  disk: null,
  os: null,
  time: null
};

let openclawCache = {
  agents: [],
  status: 'unknown',
  lastUpdate: null
};

// Get system info
async function getSystemInfo() {
  try {
    const [cpu, mem, disk, osInfo] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.fsSize(),
      si.osInfo()
    ]);
    
    systemCache = {
      cpu: {
        load: cpu.currentLoad.toFixed(1),
        cores: cpu.cpus.map(c => c.load.toFixed(1))
      },
      memory: {
        total: (mem.total / (1024*1024*1024)).toFixed(1),
        used: (mem.used / (1024*1024*1024)).toFixed(1),
        free: (mem.free / (1024*1024*1024)).toFixed(1),
        percent: ((mem.used / mem.total) * 100).toFixed(1)
      },
      disk: disk.map(d => ({
        mount: d.mount,
        size: (d.size / (1024*1024*1024)).toFixed(1),
        used: (d.used / (1024*1024*1024)).toFixed(1),
        usePercent: d.use
      })),
      os: {
        platform: osInfo.platform,
        distro: osInfo.distro,
        release: osInfo.release,
        hostname: osInfo.hostname
      },
      time: new Date().toISOString()
    };
    
    return systemCache;
  } catch (e) {
    console.error('System info error:', e);
    return systemCache;
  }
}

// Get OpenClaw status (local)
async function getOpenClawStatus() {
  try {
    const response = await fetch('http://localhost:18789/api/status', {
      method: 'GET'
    });
    
    if (response.ok) {
      const data = await response.json();
      openclawCache = {
        status: 'online',
        agents: data.agents || [],
        lastUpdate: new Date().toISOString()
      };
    } else {
      openclawCache.status = 'error';
    }
  } catch (e) {
    openclawCache.status = 'offline';
    console.log('OpenClaw not reachable:', e.message);
  }
  
  return openclawCache;
}

// API Routes
app.get('/api/system', async (req, res) => {
  const info = await getSystemInfo();
  res.json(info);
});

app.get('/api/openclaw', async (req, res) => {
  const status = await getOpenClawStatus();
  res.json(status);
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    time: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Dashboard data (combined)
app.get('/api/dashboard', async (req, res) => {
  const [system, openclaw] = await Promise.all([
    getSystemInfo(),
    getOpenClawStatus()
  ]);
  
  res.json({
    system,
    openclaw,
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 System Monitor running on http://localhost:${PORT}`);
  console.log(`📊 Dashboard API: http://localhost:${PORT}/api/dashboard`);
  console.log(`🖥️ System Info: http://localhost:${PORT}/api/system`);
  console.log(`🤖 OpenClaw: http://localhost:${PORT}/api/openclaw`);
});

// Update system info every 10 seconds
setInterval(getSystemInfo, 10000);
setInterval(getOpenClawStatus, 30000);
