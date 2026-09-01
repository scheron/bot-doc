<template>
  <footer class="site-footer">
    <div class="site-footer__copyright">{{ copyright }}</div>
    <MachineReadableLinks />
  </footer>
</template>

<script>
import MachineReadableLinks from '@theme/components/MachineReadableLinks.vue'

export default {
  name: 'SiteFooter',

  components: { MachineReadableLinks },

  computed: {
    copyright () {
      return this.$page.frontmatter.footer || this.$themeLocaleConfig.footer || ''
    }
  }
}
</script>

<style lang="stylus">
.site-footer
  display flex
  align-items center
  justify-content space-between
  flex-wrap wrap
  gap 0.75rem 1.5rem
  border-top 1px solid $borderColor
  color lighten($textColor, 25%)
  font-size 0.9rem

  &__copyright
    white-space nowrap

@media (max-width: $MQMobileNarrow)
  .site-footer
    flex-direction column
    align-items flex-start
</style>
