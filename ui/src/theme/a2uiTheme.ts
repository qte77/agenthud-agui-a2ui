import { defaultTheme, type Theme } from "@a2ui/react";

// Plan 008 / PR1 — A2UI surface theming.
//
// The @a2ui catalog's default theme assigns each component a class map whose classes
// resolve through CSS variables (--n-*, --p-*, --font-family-flex) this app never defines,
// so Card/Button/Tabs/Text render unstyled. We route the visually load-bearing components
// to our OWN class hooks (`qte-*`), styled in ui/src/index.css against the existing EyeRest
// @theme tokens. `classMapToString` just space-joins the truthy keys, so the class names are
// arbitrary — this couples us only to the exported `Theme` *shape*, not to any library-internal
// utility-class or CSS-variable naming (the robust seam). Every other component keeps the
// library default (spread below) until a real UI actually needs it themed (YAGNI).
export const qteA2uiTheme: Theme = {
  ...defaultTheme,
  components: {
    ...defaultTheme.components,
    Card: { "qte-card": true },
    Button: { "qte-button": true },
    // Size images by usage hint (the catalog leaves them unconstrained → a giant avatar).
    Image: {
      all: { "qte-img": true },
      icon: { "qte-img-icon": true },
      avatar: { "qte-img-avatar": true },
      smallFeature: { "qte-img-sm": true },
      mediumFeature: { "qte-img-md": true },
      largeFeature: { "qte-img-lg": true },
      header: { "qte-img-header": true },
    },
    Tabs: {
      ...defaultTheme.components.Tabs,
      controls: {
        all: { "qte-tab": true },
        selected: { "qte-tab-active": true },
      },
    },
    Text: {
      all: { "qte-text": true },
      h1: { "qte-text-h1": true },
      h2: { "qte-text-h2": true },
      h3: { "qte-text-h3": true },
      h4: { "qte-text-h4": true },
      h5: { "qte-text-h5": true },
      body: { "qte-text-body": true },
      caption: { "qte-text-caption": true },
    },
  },
};
