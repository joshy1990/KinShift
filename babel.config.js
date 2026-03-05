module.exports = function(api) {
  api.cache(true);

  const plugins = [
    [
      'inline-dotenv',
      {
        path: '.env.local', // Path to your .env.local file
        systemVar: 'overwrite' // Use .env.local values over system env vars
      }
    ]
  ];

  // Strip console.log/warn/info in production builds (keep console.error)
  if (process.env.NODE_ENV === 'production' || process.env.BABEL_ENV === 'production') {
    plugins.push([
      'transform-remove-console',
      { exclude: ['error'] }
    ]);
  }

  return {
    presets: ['babel-preset-expo'],
    plugins,
  };
};
