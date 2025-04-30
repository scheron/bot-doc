const { description } = require('../../package')
const path = require('path');

module.exports = {
  /**
   * Ref：https://v1.vuepress.vuejs.org/config/#title
   */
  title: 'Документация торговых роботов компании "Викинг"',
  base: '/bot-doc/',
  /**
   * Ref：https://v1.vuepress.vuejs.org/config/#description
   */
  description: "Руководство пользователя, описание алгоритма и API",

  /**
   * Extra tags to be injected to the page HTML `<head>`
   *
   * ref：https://v1.vuepress.vuejs.org/config/#head
   */
  head: [
    ['meta', { name: 'theme-color', content: '#3eaf7c' }],
    ['meta', { name: 'apple-mobile-web-app-capable', content: 'yes' }],
    ['meta', { name: 'apple-mobile-web-app-status-bar-style', content: 'black' }],
    ['link', { rel: 'stylesheet', href: 'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.5.1/katex.min.css' }],
    ['link', { rel: 'stylesheet', href: 'https://cdn.jsdelivr.net/github-markdown-css/2.2.1/github-markdown.css' }],
    ['link', { rel: 'icon', href: '/favicon.ico' }]
  ],

  /**
   * Theme configuration, here is the default theme configuration for VuePress.
   *
   * ref：https://v1.vuepress.vuejs.org/theme/default-theme-config.html
   */
  themeConfig: {
    logo: '/images/vkg_logo.svg',
    repo: '',
    editLinks: false,
    docsDir: 'docs',
    editLinkText: '',
    lastUpdated: false,
    algolia: {
      apiKey: '7d6295408b07d0fac47f9f4f4082d107',
      indexName: 'test_viking2',
      // If Algolia did not provided you any `appId`, use `BH4D9OD16A` or remove this option
      appId: 'GRBQWTRZK3',
      searchParameters: {
        queryLanguages: ['en', 'ru'],
        ignorePlurals: true,
        advancedSyntax: true,
        hitsPerPage: 10
      }
    },
    nav: [
      {
        text: 'Документация',
        link: '/docs/'
      }
    ],
     sidebar: {
      '/docs/': [
        {
          collapsable: false,
          children: [
            'change-history',
            'introduction',
            'getting-started',
            'stable-work',
            'creating-connection',
            'params-description',
            'algorithm-comments',
            'order-error',
            'c-api',
            'faq',
            'api'
          ]
        }
      ],

    }
  },
  markdown: {
    extractHeaders: [ 'h2', 'h3', 'h4', 'h5','h6' ],
    extendMarkdown: md => {
      md.use(require('markdown-it'))
      .use(require('markdown-it-attrs'))
      .use(require('markdown-it-katex'))
      .use(require('markdown-it-anchor'))
    }
  },
  /**
   * Apply plugins，ref：https://v1.vuepress.vuejs.org/zh/plugin/
   */
  plugins: [
    '@vuepress/plugin-back-to-top',
    '@vuepress/plugin-medium-zoom',
  ],
  configureWebpack: {
    resolve: {
      alias: {
        '@images': path.resolve(__dirname, '..', 'docs', '00-img'),
      }
    }
  }
}
