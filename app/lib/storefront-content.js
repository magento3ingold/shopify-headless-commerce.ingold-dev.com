/**
 * Editorial content for the storefront design system.
 *
 * Everything in this file is PLACEHOLDER content: copy, images and links that
 * are not stored in Shopify. Replace the values here (or move them to Shopify
 * metaobjects / a CMS later) without touching the components that render them.
 *
 * Product, collection, price, availability and cart data are NOT defined here;
 * they are always loaded from the Storefront API.
 *
 * Paths are root-relative; components localize them for the active market.
 */
import aboutStudio from '~/assets/placeholders/about-studio.svg';

// Header navigation comes from the Shopify "main-menu" (see ~/lib/navigation),
// hero slides from "Homepage Banner" metaobjects (~/lib/homepage-banners) and
// promotional cards from "Homepage Promo" metaobjects (~/lib/homepage-promos)
// the About section from "Homepage About Content" (~/lib/homepage-about) and
// the benefits from "Homepage Benefits" (~/lib/homepage-benefits).

// Footer logo, contact details, social links and link columns all come from
// Shopify (Site Settings, Contact Information and Social Media metaobjects and
// the footer menus); see components/Footer.jsx.
export const FOOTER = {
  // Display-only placeholder. Shopify checkout shows the real payment methods.
  paymentMethods: ['Visa', 'Mastercard', 'Amex', 'PayPal', 'Shop Pay'],
};

// Contact details come from the "Contact Information" metaobject
// (~/lib/contact-information).

export const ABOUT_PAGE = {
  hero: {
    eyebrow: 'About us',
    heading: 'Made with intention, designed to last',
    description:
      'We create considered everyday pieces that balance timeless design, quality materials and honest value.',
  },
  intro:
    'What started as a small studio with a handful of products has grown into a collection trusted by customers around the world. Our approach has never changed: design fewer, better things and stand behind every one of them.',
  story: {
    heading: 'Our Story',
    body: [
      'We began with a frustration many people share: wardrobes full of things that did not last. So we set out to build a brand around durability, comfort and design that does not chase trends.',
      'Today we work closely with a small group of trusted makers, visiting their workshops, refining every detail and testing each product until it meets our standard.',
    ],
    image: {
      src: aboutStudio,
      alt: 'Abstract studio composition in warm neutrals',
      width: 1200,
      height: 900,
    },
  },
  mission: {
    heading: 'Our Mission',
    body: 'To make well-designed, long-lasting essentials accessible, and to make every step of shopping with us simple, transparent and enjoyable.',
  },
  values: [
    {
      title: 'Quality first',
      description:
        'We choose materials and construction methods that stand up to everyday life.',
    },
    {
      title: 'Thoughtful design',
      description:
        'Clean, versatile pieces that work together and remain relevant season after season.',
    },
    {
      title: 'Responsible choices',
      description:
        'We partner with makers who share our commitment to fair work and reduced waste.',
    },
    {
      title: 'Customer care',
      description:
        'Real people, quick answers and a return process that respects your time.',
    },
  ],
};
