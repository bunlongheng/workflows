module.exports = {
  apps: [{
    name: 'automations',
    script: 'index.js',
    cwd: '/home/bheng/automations/server',
    env_file: '/home/bheng/automations/server/.env',
    watch: false,
    max_restarts: 10,
    restart_delay: 5000,
    autorestart: true,
    max_memory_restart: '300M',
  }],
};
