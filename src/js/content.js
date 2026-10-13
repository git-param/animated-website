/**
 * Editable content & configuration.
 *
 * Everything here is either copy taken from the supplied artwork (cookbook cover, bottle label) or a clearly
 * marked placeholder. No impact statistics, prices, testimonials or product claims have been invented.
 */

export const content = {
  /**
   * Long-form copy. Leave a value as '' to keep the placeholder text that ships in index.html.
   * Fill them in with your own words — the placeholder styling is removed automatically.
   */
  story: {
    body: '',
  },
  catering: {
    body: '',
  },
  donate: {
    body: '',
  },

  /**
   * Optional external destinations. When set, the matching nav link / row opens that URL instead of
   * scrolling to the in-page section. Leave null to keep the in-page behaviour.
   *   e.g. catering: 'https://example.com/catering'
   */
  links: {
    catering: null,
    donate: null,
  },

  /** Products shown in the shop and used by the front-end bag demo. No prices: none were supplied. */
  products: {
    cookbook: { id: 'cookbook', name: 'Two Good Cookbook Two', detail: 'Recipes for resilience' },
    lotion: { id: 'lotion', name: 'Nourish & Soothe', detail: 'Hand lotion · Cedarwood & cinnamon' },
    tote: { id: 'tote', name: 'Project X Tote', detail: 'Tote bag' },
  },
};
