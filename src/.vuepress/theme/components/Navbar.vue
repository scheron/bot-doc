<template>
  <header class="navbar">
    <SidebarButton @toggle-sidebar="$emit('toggle-sidebar')" />

    <RouterLink
      :to="$localePath"
      class="home-link"
    >
      <img
        v-if="$site.themeConfig.logo"
        class="logo"
        :src="$withBase($site.themeConfig.logo)"
        :alt="$siteTitle"
      >
      <span
        v-if="$siteTitle"
        ref="siteName"
        class="site-name"
        :class="{ 'can-hide': $site.themeConfig.logo }"
      >{{ $siteTitle }}</span>
    </RouterLink>

    <div class="links">
      <AlgoliaSearchBox
        v-if="isAlgoliaSearch"
        :options="algolia"
      />
      <NavLinks class="can-hide" />
      <a
        class="github-link"
        :href="$site.themeConfig.repositoryUrl"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="GitHub repository"
        title="GitHub"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M12 .7a11.5 11.5 0 0 0-3.64 22.4c.58.1.79-.25.79-.56v-2.24c-3.22.7-3.9-1.37-3.9-1.37-.52-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.71.08-.71 1.17.08 1.78 1.2 1.78 1.2 1.04 1.78 2.72 1.27 3.38.97.1-.75.4-1.27.74-1.56-2.57-.29-5.27-1.28-5.27-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.47.11-3.05 0 0 .97-.31 3.16 1.18a10.95 10.95 0 0 1 5.76 0c2.2-1.49 3.16-1.18 3.16-1.18.63 1.58.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.71 5.38-5.29 5.67.42.36.79 1.07.79 2.16v3.21c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .7Z" />
        </svg>
      </a>
    </div>
  </header>
</template>

<script>
// NOTE: Point to @vuepress/theme-default/components/Navbar.vue
import AlgoliaSearchBox from './AlgoliaSearchBox.vue'
import SidebarButton from '@theme/components/SidebarButton.vue'
import NavLinks from '@theme/components/NavLinks.vue'

export default {
  name: 'Navbar',

  components: {
    SidebarButton,
    NavLinks,
    AlgoliaSearchBox
  },

  computed: {
    algolia () {
      return this.$themeLocaleConfig.algolia || this.$site.themeConfig.algolia || {}
    },

    isAlgoliaSearch () {
      return this.algolia && this.algolia.apiKey && this.algolia.indexName
    }
  }
}
</script>

<style lang="stylus">
$navbar-vertical-padding = 0.7rem
$navbar-horizontal-padding = 1.5rem

.navbar
  padding $navbar-vertical-padding $navbar-horizontal-padding
  display flex
  align-items center
  .home-link
    display flex
    align-items center
    min-width 0
  .logo
    height $navbarHeight - 1.4rem
    min-width $navbarHeight - 1.4rem
    margin-right 0.8rem
    flex 0 0 auto
  .site-name
    font-size 1.3rem
    font-weight 600
    line-height 1.3
    color $textColor
    overflow hidden
    white-space nowrap
    text-overflow ellipsis
  .links
    margin-left auto
    padding-left 1.5rem
    box-sizing border-box
    background-color white
    white-space nowrap
    font-size 0.9rem
    display flex
    align-items center
    flex 0 0 auto
    .search-box
      flex 0 0 auto
    .github-link
      display flex
      align-items center
      justify-content center
      width 1.5rem
      height 1.5rem
      margin-left 1.25rem
      color $textColor
      flex 0 0 auto
      &:hover
        color $accentColor
      svg
        display block
        width 100%
        height 100%
        fill currentColor

@media (max-width: $MQMobile)
  .navbar
    padding-left 4rem
    .can-hide
      display none
    .links
      padding-left 1rem
</style>