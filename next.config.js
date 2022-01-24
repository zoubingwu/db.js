const WindiCSSWebpackPlugin = require('windicss-webpack-plugin')

module.exports = {
  async redirects() {
    return [
      {
        source: '/1',
        destination: '/',
        permanent: true,
      },
    ]
  },

  webpack(config, { dev, isServer }) {
    config.plugins.push(new WindiCSSWebpackPlugin())

    // Replace React with Preact only in client production build
    if (!dev && !isServer) {
      Object.assign(config.resolve.alias, {
        react: 'preact/compat',
        'react-dom/test-utils': 'preact/test-utils',
        'react-dom': 'preact/compat',
      });
    }

    return config
  },
}