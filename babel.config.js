module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ['@babel/plugin-transform-private-methods', { loose: true }],
      ['@babel/plugin-transform-class-properties', { loose: true }],
      [
        'inline-dotenv',
        {
          path: '.env.local', // Path to your .env.local file
          systemVar: 'overwrite' // Use .env.local values over system env vars
        }
      ]
    ]
  };
};
