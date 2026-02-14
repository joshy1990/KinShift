module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
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
