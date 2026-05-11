module.exports = {
  apps: [
    {
      name: 'automations',
      script: 'index.js',
      cwd: '/home/bheng/automations/server',
      env: {
        NODE_ENV: 'production',
        PORT: 3009,
      },
      env_file: '/home/bheng/automations/server/.env',
      watch: false,
      max_restarts: 10,
      restart_delay: 5000,
    },
  ],
};
