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

  webpack(config) {
    config.plugins.push(new WindiCSSWebpackPlugin())
    return config
  },
}