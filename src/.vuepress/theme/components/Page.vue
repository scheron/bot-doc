<template>
  <main class="page">
    <slot name="top" />

    <div ref="actions" class="page-actions">
      <CopyPageButton />
    </div>

    <Content class="theme-default-content" />
    <PageEdit />

    <PageNav v-bind="{ sidebarItems }" />

    <SiteFooter />

    <slot name="bottom" />
  </main>
</template>

<script>
// NOTE: Point to @vuepress/theme-default/components/Page.vue
import CopyPageButton from '@theme/components/CopyPageButton.vue'
import PageEdit from '@theme/components/PageEdit.vue'
import PageNav from '@theme/components/PageNav.vue'
import SiteFooter from '@theme/components/SiteFooter.vue'

export default {
  components: { CopyPageButton, PageEdit, PageNav, SiteFooter },
  props: ['sidebarItems']
}
</script>

<style lang="stylus">
.page
  padding-bottom 2rem
  display block
  position relative

  // NOTE: 2rem is the content wrapper padding, $navbarHeight is the first heading margin
  // NOTE: left matches .page padding-left so the button centers with the content column, not the viewport
  .page-actions
    position absolute
    top ($navbarHeight + 2rem)
    left $sidebarWidth
    right 0
    max-width $contentWidth
    margin 0 auto
    padding 0 2.5rem
    display flex
    justify-content flex-end
    pointer-events none
    z-index 5

    .copy-page
      pointer-events auto

  .theme-default-content:not(.custom) > h1
    padding-right 14rem

  .site-footer
    max-width $contentWidth
    margin 0 auto
    padding 1.5rem 2.5rem 0

@media (max-width: $MQNarrow)
  .page
    .page-actions
      left ($sidebarWidth * 0.82)
      padding 0 2rem

    .site-footer
      padding-left 2rem
      padding-right 2rem

@media (max-width: $MQMobile)
  .page
    .page-actions
      position static
      justify-content flex-start
      left auto
      max-width none
      padding ($navbarHeight + 1rem) 2rem 0

    .theme-default-content:not(.custom) > h1
      padding-right 0
      padding-top 0.5rem
      margin-top 0

@media (max-width: $MQMobileNarrow)
  .page
    .page-actions
      padding-left 1.5rem
      padding-right 1.5rem

    .site-footer
      padding-left 1.5rem
      padding-right 1.5rem
</style>
