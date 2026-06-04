module.exports = {
  apps: [
    {
      name: "seev",
      script: "npm",
      args: "run start",
      cwd: "/data/2026Y/Project/seeval",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
      },
      max_memory_restart: "1G",
      autorestart: true,
      watch: false,
    },
  ],
};
