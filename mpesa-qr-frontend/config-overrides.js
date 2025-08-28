module.exports = function override(config) {
  // Add Node.js polyfills
  config.resolve.fallback = {
    "http": require.resolve("stream-http"),
    "https": require.resolve("https-browserify"),
    "stream": require.resolve("stream-browserify"),
    "zlib": require.resolve("browserify-zlib"),
    "url": false,
    "util": false,
    "assert": false
  };
  
  return config;
}