/**
 * Client app enhancement file.
 *
 * https://v1.vuepress.vuejs.org/guide/basic-config.html#app-level-enhancements
 */

export default ({
  Vue, // the version of Vue being used in the VuePress app
  options, // the options for the root Vue instance
  router, // the router instance for the app
  siteData // site metadata
}) => {
  const featureLinks = siteData.pages?.find(page => page.path === '/')?.frontmatter?.features?.map(feature => feature.link)

  router.afterEach((to) => {
    setTimeout(() => {
      try {
        const isHomePage = to.path === '/'
        if (!isHomePage) return

        const features = document.querySelectorAll('.features .feature');

        features.forEach((feature, index) => {
          const h2 = feature.querySelector('h2');

          if (!h2 || !featureLinks || !featureLinks?.[index]) return

          const a = document.createElement('a');
          a.href = featureLinks[index];
          a.textContent = h2.textContent;
          a.classList.add('feature-link');

          h2.replaceWith(a);
        });

      } catch (error) {
        console.error('Error in enhanceApp.js', error)
      }
    }, 100);
  });
  // ...apply enhancements for the site.
}
