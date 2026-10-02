/**
 * Admin GraphQL API operations for the custom product review system
 * (~/lib/product-reviews.server). Server only.
 *
 * Required Admin API access scopes: `read_metaobject_definitions`,
 * `read_metaobjects`, `write_metaobjects`.
 *
 * Kept in app/graphql/ so the Storefront API codegen project (see
 * .graphqlrc.js) does not validate them against the Storefront schema. They
 * are validated against the Admin API 2026-04 schema in the review tests.
 */

// Finds the "Custom Product Review" definition: its type and field keys are
// read from Shopify, never assumed.
export const REVIEW_DEFINITIONS_QUERY = `#graphql
  query ReviewDefinitions($after: String) {
    metaobjectDefinitions(first: 100, after: $after) {
      nodes {
        type
        name
        fieldDefinitions {
          key
          name
          required
          type {
            name
          }
          validations {
            name
            value
          }
          capabilities {
            adminFilterable {
              enabled
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

// Approved reviews of one product, newest first, with only the fields
// needed for the summary and sorting (no customer data).
export const REVIEW_RATINGS_QUERY = `#graphql
  query ReviewRatings(
    $type: String!
    $query: String!
    $after: String
    $productKey: String!
    $statusKey: String!
    $ratingKey: String!
  ) {
    metaobjects(
      type: $type
      query: $query
      first: 250
      after: $after
      sortKey: "id"
      reverse: true
    ) {
      nodes {
        id
        product: field(key: $productKey) {
          value
        }
        status: field(key: $statusKey) {
          value
        }
        rating: field(key: $ratingKey) {
          value
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

// Full entries for one page of reviews. The customer email field is never
// requested.
export const REVIEW_ENTRIES_QUERY = `#graphql
  query ReviewEntries(
    $ids: [ID!]!
    $productKey: String!
    $statusKey: String!
    $ratingKey: String!
    $nameKey: String!
    $titleKey: String!
    $textKey: String!
    $verifiedKey: String!
    $createdAtKey: String!
  ) {
    nodes(ids: $ids) {
      ... on Metaobject {
        id
        createdAt
        product: field(key: $productKey) {
          value
        }
        status: field(key: $statusKey) {
          value
        }
        rating: field(key: $ratingKey) {
          value
        }
        name: field(key: $nameKey) {
          value
        }
        title: field(key: $titleKey) {
          value
        }
        text: field(key: $textKey) {
          value
        }
        verified: field(key: $verifiedKey) {
          value
        }
        reviewCreatedAt: field(key: $createdAtKey) {
          value
        }
      }
    }
  }
`;

export const REVIEW_CREATE_MUTATION = `#graphql
  mutation ReviewCreate($metaobject: MetaobjectCreateInput!) {
    metaobjectCreate(metaobject: $metaobject) {
      metaobject {
        id
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`;
