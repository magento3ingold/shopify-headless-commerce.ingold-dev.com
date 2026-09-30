// Customer Account API operations for the signed-in customer's wishlist,
// stored in the customer metafield custom.wishlist (type: json).
// Used server-side only by ~/lib/wishlist/customer-wishlist.server.

// NOTE: https://shopify.dev/docs/api/customer/latest/objects/Customer
export const CUSTOMER_WISHLIST_QUERY = `#graphql
  query CustomerWishlist {
    customer {
      id
      wishlist: metafield(namespace: "custom", key: "wishlist") {
        id
        type
        value
        jsonValue
        compareDigest
      }
    }
  }
`;

// NOTE: https://shopify.dev/docs/api/customer/latest/mutations/metafieldsSet
export const CUSTOMER_WISHLIST_SET_MUTATION = `#graphql
  mutation CustomerWishlistSet($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields {
        id
        namespace
        key
        type
        value
        compareDigest
      }
      userErrors {
        field
        message
        code
        elementIndex
      }
    }
  }
`;
