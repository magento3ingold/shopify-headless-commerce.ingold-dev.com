import {CONTACT_INFORMATION_FRAGMENT} from './contact-information.js';
import {SOCIAL_MEDIA_FRAGMENT} from './social-media.js';

// NOTE: https://shopify.dev/docs/api/storefront/latest/queries/cart
export const CART_QUERY_FRAGMENT = `#graphql
  fragment Money on MoneyV2 {
    currencyCode
    amount
  }
  fragment CartLine on CartLine {
    id
    quantity
    attributes {
      key
      value
    }
    cost {
      totalAmount {
        ...Money
      }
      amountPerQuantity {
        ...Money
      }
      compareAtAmountPerQuantity {
        ...Money
      }
    }
    merchandise {
      ... on ProductVariant {
        id
        availableForSale
        compareAtPrice {
          ...Money
        }
        price {
          ...Money
        }
        requiresShipping
        title
        image {
          id
          url
          altText
          width
          height

        }
        product {
          handle
          title
          id
          vendor
        }
        selectedOptions {
          name
          value
        }
      }
    }
    parentRelationship {
      parent {
        id
      }
    }
  }
  fragment CartLineComponent on ComponentizableCartLine {
    id
    quantity
    attributes {
      key
      value
    }
    cost {
      totalAmount {
        ...Money
      }
      amountPerQuantity {
        ...Money
      }
      compareAtAmountPerQuantity {
        ...Money
      }
    }
    merchandise {
      ... on ProductVariant {
        id
        availableForSale
        compareAtPrice {
          ...Money
        }
        price {
          ...Money
        }
        requiresShipping
        title
        image {
          id
          url
          altText
          width
          height
        }
        product {
          handle
          title
          id
          vendor
        }
        selectedOptions {
          name
          value
        }
      }
    }
    lineComponents {
      ...CartLine
    }
  }
  fragment CartApiQuery on Cart {
    updatedAt
    id
    appliedGiftCards {
      id
      lastCharacters
      amountUsed {
        ...Money
      }
    }
    checkoutUrl
    totalQuantity
    buyerIdentity {
      countryCode
      customer {
        id
        email
        firstName
        lastName
        displayName
      }
      email
      phone
    }
    lines(first: $numCartLines) {
      nodes {
        ...CartLine
      }
      nodes {
        ...CartLineComponent
      }
    }
    cost {
      subtotalAmount {
        ...Money
      }
      totalAmount {
        ...Money
      }
      totalDutyAmount {
        ...Money
      }
      totalTaxAmount {
        ...Money
      }
    }
    note
    attributes {
      key
      value
    }
    discountCodes {
      code
      applicable
    }
  }
`;

const MENU_FRAGMENT = `#graphql
  fragment MenuItem on MenuItem {
    id
    resourceId
    tags
    title
    type
    url
  }
  # Shopify menus support three levels: top level > child > grandchild.
  fragment GrandchildMenuItem on MenuItem {
    ...MenuItem
  }
  fragment ChildMenuItem on MenuItem {
    ...MenuItem
    items {
      ...GrandchildMenuItem
    }
  }
  fragment ParentMenuItem on MenuItem {
    ...MenuItem
    items {
      ...ChildMenuItem
    }
  }
  fragment Menu on Menu {
    id
    title
    items {
      ...ParentMenuItem
    }
  }
`;

// A file_reference field resolves to MediaImage (raster images uploaded to
// Files) or GenericFile (other uploads, e.g. some SVGs). Raster logos are
// requested pre-resized from the Shopify CDN; width/height keep the aspect
// ratio so the header does not shift while the logo loads.
const SITE_SETTINGS_FRAGMENT = `#graphql
  fragment SiteSettingsLogo on MetafieldReference {
    __typename
    ... on MediaImage {
      id
      image {
        url(transform: {maxHeight: 120})
        altText
        width
        height
      }
    }
    ... on GenericFile {
      id
      url
      alt
      mimeType
    }
  }
  fragment SiteSettings on Metaobject {
    id
    handle
    siteName: field(key: "site_name") {
      value
    }
    logo: field(key: "logo") {
      reference {
        ...SiteSettingsLogo
      }
    }
    mobileLogo: field(key: "mobile_logo") {
      reference {
        ...SiteSettingsLogo
      }
    }
  }
`;

export const HEADER_QUERY = `#graphql
  fragment Shop on Shop {
    id
    name
    description
    primaryDomain {
      url
    }
  }
  query Header(
    $country: CountryCode
    $headerMenuHandle: String!
    $footerShopMenuHandle: String!
    $footerCompanyMenuHandle: String!
    $footerServiceMenuHandle: String!
    $language: LanguageCode
  ) @inContext(language: $language, country: $country) {
    shop {
      ...Shop
    }
    menu(handle: $headerMenuHandle) {
      ...Menu
    }
    # Footer columns. A missing menu resolves to null and only hides its column.
    footerShopMenu: menu(handle: $footerShopMenuHandle) {
      ...Menu
    }
    footerCompanyMenu: menu(handle: $footerCompanyMenuHandle) {
      ...Menu
    }
    footerServiceMenu: menu(handle: $footerServiceMenuHandle) {
      ...Menu
    }
    # "Site Settings" metaobject (type: site_settings). Only the first entry is
    # used. Requires Storefront API access on the metaobject definition.
    siteSettings: metaobjects(type: "site_settings", first: 1) {
      nodes {
        ...SiteSettings
      }
    }
    # Global contact details and social links (~/lib/contact-information,
    # ~/lib/social-media), exposed to every page through the root loader.
    contactInformation: metaobjects(type: "contact_information", first: 1) {
      nodes {
        ...ContactInformation
      }
    }
    socialMedia: metaobjects(type: "social_media", first: 1) {
      nodes {
        ...SocialMedia
      }
    }
  }
  ${MENU_FRAGMENT}
  ${SITE_SETTINGS_FRAGMENT}
  ${CONTACT_INFORMATION_FRAGMENT}
  ${SOCIAL_MEDIA_FRAGMENT}
`;

// Shared by every ProductCard (homepage sections and collection grids).
// `variantsCount` and `requiresSellingPlan` decide whether a product can be
// added to the cart straight from the card or needs its product page first.
export const PRODUCT_CARD_FRAGMENT = `#graphql
  fragment ProductCardMoney on MoneyV2 {
    amount
    currencyCode
  }
  fragment ProductCard on Product {
    id
    handle
    title
    availableForSale
    requiresSellingPlan
    variantsCount {
      count
    }
    featuredImage {
      id
      altText
      url
      width
      height
    }
    priceRange {
      minVariantPrice {
        ...ProductCardMoney
      }
      maxVariantPrice {
        ...ProductCardMoney
      }
    }
    selectedOrFirstAvailableVariant(
      selectedOptions: []
      ignoreUnknownOptions: true
      caseInsensitiveMatch: true
    ) {
      id
      title
      availableForSale
      price {
        ...ProductCardMoney
      }
      compareAtPrice {
        ...ProductCardMoney
      }
      image {
        id
        altText
        url
        width
        height
      }
      selectedOptions {
        name
        value
      }
      product {
        handle
        title
      }
    }
  }
`;

export const COLLECTION_CARD_FRAGMENT = `#graphql
  fragment CollectionCard on Collection {
    id
    title
    handle
    image {
      id
      url
      altText
      width
      height
    }
  }
`;

/**
 * Shopify filter definitions (Search & Discovery) with their values, counts
 * and optional swatches, for collection and search product listings.
 */
export const PRODUCT_FILTER_FRAGMENT = `#graphql
  fragment ProductFilterImage on MediaImage {
    image {
      url(transform: {maxWidth: 64, maxHeight: 64})
    }
  }
  fragment ProductFilter on Filter {
    id
    label
    type
    presentation
    values {
      id
      label
      count
      input
      swatch {
        color
        image {
          ...ProductFilterImage
        }
      }
      image {
        ...ProductFilterImage
      }
    }
  }
`;

/**
 * Price data used to decide "on sale" (see ~/lib/sale.server), spread
 * next to `...ProductCard`.
 */
export const PRODUCT_SALE_FRAGMENT = `#graphql
  fragment ProductSaleFields on Product {
    compareAtPriceRange {
      maxVariantPrice {
        amount
      }
    }
  }
`;
