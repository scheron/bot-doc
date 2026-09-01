const fs = require('fs')

/**
 * Injects <link rel="alternate"> to the page's Markdown twin and
 * <link rel="describedby"> to llms.txt into the <head> of every documentation page.
 */
module.exports = (options, ctx) => ({
  name: 'viking-ai-discovery',

  generated (pagePaths) {
    const base = ctx.base

    pagePaths.forEach(pagePath => {
      const normalizedPath = pagePath.replace(/\\/g, '/')
      const match = normalizedPath.match(/\/(en\/)?docs\/([^/]+)\.html$/)
      if (!match) return

      const localePrefix = match[1] || ''
      const slug = match[2]
      const discovery = [
        `<link rel="alternate" type="text/markdown" href="${base}${localePrefix}docs/${slug}.md">`,
        `<link rel="describedby" type="text/plain" href="${base}${localePrefix}llms.txt">`
      ].join('\n    ')
      const html = fs.readFileSync(pagePath, 'utf8')

      fs.writeFileSync(pagePath, html.replace('</head>', `    ${discovery}\n  </head>`), 'utf8')
    })
  }
})
