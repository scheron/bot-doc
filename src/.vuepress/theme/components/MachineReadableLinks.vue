<template>
  <nav class="machine-readable-links">
    <a :href="llmsHref">llms.txt</a>
    <a :href="sitemapHref">sitemap.md</a>
  </nav>
</template>

<script>
export default {
  computed: {
    isEnglish () {
      return this.$page.path.startsWith('/en/')
    },

    rawPublishedBase () {
      return this.$site.themeConfig.rawPublishedBase.replace(/\/$/, '')
    },

    /**
     * The canonical llms.txt — the same URL the <link rel="describedby"> of every
     * page points at. GitHub Pages serves .txt as text/plain, so it opens in the
     * browser.
     */
    llmsHref () {
      return this.$withBase(this.isEnglish ? '/en/llms.txt' : '/llms.txt')
    },

    /**
     * sitemap.md stays on raw.githubusercontent.com: GitHub Pages serves .md as
     * text/markdown, which browsers download instead of showing.
     */
    sitemapHref () {
      return `${this.rawPublishedBase}${this.isEnglish ? '/en/sitemap.md' : '/sitemap.md'}`
    }
  }
}
</script>

<style lang="stylus">
.machine-readable-links
  display flex
  align-items center
  gap 1.25rem

  a
    white-space nowrap
    color lighten($textColor, 25%)

    &:hover
      color $accentColor
</style>
