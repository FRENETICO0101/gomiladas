module.exports = {
  apps: [
    {
      name: 'gomitas',
      cwd: './server',
      script: 'src/index.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: true,
      env: {
        NODE_ENV: 'production',
        PORT: '3001',
        // Cambia este valor al subdominio público que usarás
        PUBLIC_BASE_URL: 'https://pedido.gomiladas.com',
      },
    },
  ],
};
