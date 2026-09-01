const path = require('path');
const aiDiscovery = require('./plugins/ai-discovery');

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

  locales: {
    '/': {
      lang: 'ru-RU',
      title: 'Документация торговых роботов компании "Викинг"',
      description: 'Руководство пользователя, описание алгоритма и API'
    },
    '/en/': {
      lang: 'en-US',
      title: 'Documentation for Viking\'s trading robots',
      description: 'User guide, algorithm description and API'
    }
  },
  themeConfig: {
    logo: '/images/vkg_logo_en.svg',
    repositoryUrl: 'https://github.com/fkviking/bot-doc',
    rawPublishedBase: 'https://raw.githubusercontent.com/fkviking/bot-doc/gh-pages',
    locales: {
      '/': {
        lang: 'ru-RU',
        title: 'Документация торговых роботов компании "Викинг"',
        description: 'Руководство пользователя, описание алгоритма и API',
        footer: 'ФК Викинг | Copyright © 2010-2026',
        copyPage: {
          copy: 'Копировать страницу',
          copying: 'Копирую…',
          copied: 'Скопировано',
          failed: 'Не удалось',
          viewMarkdown: 'Посмотреть как Markdown',
          openIn: 'Открыть в',
          prompt: 'Прочитай {url} — я хочу задать вопросы по этой странице документации.'
        },
        selectText: '🇷🇺 RU',
        label: '🇷🇺 RU',
        ariaLabel: 'Languages',
        searchPlaceholder: 'Поиск...',
        algolia: {
          apiKey: '94ee5ea090e8169a1c1fa8c35b0189ed',
          indexName: 'test_viking2',
          appId: 'TMJSXT1U3B',
          searchParameters: {
            hitsPerPage: 10
          }
        },
        sidebar: {
          '/docs/': [
            {
              collapsable: false,
              children: [
                'change-history',
                'introduction',
                'interface',
                'getting-started',
                'stable-work',
                'creating-connection',
                'params-description',
                'algorithm-comments',
                'order-error',
                'c-api',
                'api',
                'comparison',
                'client_server_requirements',
                'faq'
              ]
            }
          ],
        },
        nav: [
          {
            text: 'Документация',
            link: '/docs/introduction'
          }
        ],
        repo: '',
        editLinks: false,
        docsDir: 'docs',
        editLinkText: '',
        lastUpdated: false,
      },
      '/en/': {
        lang: 'en-US',
        title: 'Documentation for Viking\'s trading robots',
        description: 'User guide, algorithm description and API',
        footer: 'FC Viking | Copyright © 2010-2026',
        copyPage: {
          copy: 'Copy page',
          copying: 'Copying…',
          copied: 'Copied',
          failed: 'Failed',
          viewMarkdown: 'View as Markdown',
          openIn: 'Open in',
          prompt: 'Read {url} — I want to ask questions about this documentation page.'
        },
        selectText: '🇺🇸 EN',
        label: '🇺🇸 EN',
        ariaLabel: 'Languages',
        searchPlaceholder: 'Search...',
        algolia: {
          apiKey: '94ee5ea090e8169a1c1fa8c35b0189ed',
          indexName: 'test_viking2',
          appId: 'TMJSXT1U3B',
          searchParameters: {
            hitsPerPage: 10
          }
        },
        sidebar: {
          '/en/docs/': [
            {
              collapsable: false,
              children: [
                'change-history',
                'introduction',
                'interface',
                'getting-started',
                'stable-work',
                'creating-connection',
                'params-description',
                'algorithm-comments',
                'order-error',
                'c-api',
                'api',
                'comparison',
                'faq'
              ]
            }
          ],
        },
        nav: [
          {
            text: 'Documentation',
            link: '/en/docs/introduction'
          }
        ],
        logo: '/images/vkg_logo_en.svg',
        repo: '',
        editLinks: false,
        docsDir: 'en/docs',
        editLinkText: '',
        lastUpdated: false,
      }
    },
  },
  /**
   * Wording of llms.txt and sitemap.md, read by scripts/generate-ai-docs.js at build time.
   * Page titles and summaries come from the frontmatter in assets/ru and assets/en.
   */
  aiDocs: {
    ru: {
      summary: 'Документация торговой платформы ФК «Викинг»: настройка арбитражных роботов, параметры портфелей, торговые подключения, формулы на C++ и WebSocket API.',
      llmsTitle: 'Документация торговых роботов ФК «Викинг»',
      formats: 'Каждая страница опубликована в двух видах: HTML по адресу `docs/<страница>.html` и Markdown по тому же пути с расширением `.md`. Ссылки ниже ведут на Markdown.',
      notesTitle: 'Notes',
      notes: [
        'Ошибка заявки часто вызвана не самой заявкой, а параметрами торгового подключения — проверяйте «Добавление подключений» вместе с «Ошибками выставления, снятия и изменения заявок».',
        'Статус `online` у торгового подключения не означает, что все его параметры корректны: часть параметров используется только при выставлении, изменении или снятии заявки.',
        'Параметры портфеля и параметры отдельных инструментов портфеля — разные наборы; в «Описании параметров» они разведены по разным разделам.'
      ],
      optionalTitle: 'Optional',
      sitemapLabel: 'Карта документации',
      sitemapSummary: 'Полный список страниц с адресами HTML- и Markdown-версий.',
      otherLocaleLabel: 'Английская версия',
      otherLocaleSummary: 'Та же документация на английском языке.',
      sitemapTitle: 'Карта документации ФК «Викинг»',
      sitemapIntro: 'Полный указатель опубликованных страниц. Для краткой навигации начните с llms.txt.',
      entryPointsTitle: 'Точки входа',
      entryPoints: {
        site: 'Документация в браузере',
        llms: 'Краткая карта для агентов',
        sitemapMd: 'Этот файл — полный указатель страниц',
        sitemapXml: 'Карта сайта для поисковых роботов'
      },
      urlPatternsTitle: 'Адреса страниц',
      pagePlaceholder: 'страница',
      urlPatterns: {
        html: 'HTML-страница',
        markdown: 'Markdown-двойник',
        englishHtml: 'HTML-страница на английском',
        englishMarkdown: 'Markdown-двойник на английском',
        russianHtml: 'HTML-страница на русском',
        russianMarkdown: 'Markdown-двойник на русском'
      },
      pagesTitle: 'Страницы'
    },
    en: {
      summary: 'Documentation for the FC Viking trading platform: arbitrage robot setup, portfolio parameters, trading connections, C++ formulas, and the WebSocket API.',
      llmsTitle: 'FC Viking Trading Robots Documentation',
      formats: 'Every page is published in two forms: HTML at `docs/<page>.html` and Markdown at the same path with a `.md` extension. The links below point at the Markdown twins.',
      notesTitle: 'Notes',
      notes: [
        'An order error is often caused by the trading connection rather than the order itself — read "Adding Connections" alongside "Order Submission, Cancellation, and Modification Errors".',
        'An `online` trading connection does not mean all of its parameters are valid: some are only used when placing, modifying, or cancelling an order.',
        'Portfolio parameters and per-instrument parameters are separate sets; "Parameters Description" keeps them in separate sections.'
      ],
      optionalTitle: 'Optional',
      sitemapLabel: 'Documentation map',
      sitemapSummary: 'Full page list with both HTML and Markdown addresses.',
      otherLocaleLabel: 'Russian version',
      otherLocaleSummary: 'The same documentation in Russian.',
      sitemapTitle: 'FC Viking Documentation Map',
      sitemapIntro: 'Complete index of published pages. For a shorter navigation surface, start with llms.txt.',
      entryPointsTitle: 'Entry points',
      entryPoints: {
        site: 'Documentation in a browser',
        llms: 'Short navigation surface for agents',
        sitemapMd: 'This file — the full page index',
        sitemapXml: 'XML sitemap for crawlers'
      },
      urlPatternsTitle: 'URL patterns',
      pagePlaceholder: 'page',
      urlPatterns: {
        html: 'HTML page',
        markdown: 'Markdown twin',
        englishHtml: 'HTML page in English',
        englishMarkdown: 'Markdown twin in English',
        russianHtml: 'HTML page in Russian',
        russianMarkdown: 'Markdown twin in Russian'
      },
      pagesTitle: 'Pages'
    }
  },
  markdown: {
    extractHeaders: ['h2', 'h3', 'h4', 'h5', 'h6'],
    extendMarkdown: md => {
      md.use(require('markdown-it'))
        .use(require('markdown-it-attrs'))
        .use(require('markdown-it-katex'))
        .use(require('markdown-it-anchor'))

      const MAX_INDEXED_FENCE_BYTES = 25000
      const renderFence = md.renderer.rules.fence
      md.renderer.rules.fence = (tokens, idx, options, env, self) => {
        const html = renderFence
          ? renderFence(tokens, idx, options, env, self)
          : self.renderToken(tokens, idx, options)

        return Buffer.byteLength(tokens[idx].content) > MAX_INDEXED_FENCE_BYTES
          ? `<div class="no-index">${html}</div>`
          : html
      }
    }
  },
  /**
   * Apply plugins，ref：https://v1.vuepress.vuejs.org/zh/plugin/
   */
  plugins: [
    '@vuepress/plugin-back-to-top',
    '@vuepress/plugin-medium-zoom',
    aiDiscovery,
  ],
  configureWebpack: {
    resolve: {
      alias: {
        '@images': path.resolve(__dirname, '..', 'docs', '00-img'),
      }
    }
  },

}
