/**
 * Admin GraphQL API operations used by the newsletter sign-up
 * (~/lib/newsletter.server). They run on the server only.
 *
 * Required Admin API access scopes: `read_customers`, `write_customers`.
 *
 * Kept in app/graphql/ so the Storefront API codegen project (see
 * .graphqlrc.js) does not validate them against the Storefront schema.
 */

// Look up an existing customer by email address.
export const NEWSLETTER_CUSTOMER_BY_EMAIL_QUERY = `#graphql
  query NewsletterCustomerByEmail($query: String!) {
    customers(first: 1, query: $query) {
      nodes {
        id
        emailMarketingConsent {
          marketingState
        }
      }
    }
  }
`;

// Create a new customer who is subscribed to email marketing.
export const NEWSLETTER_CUSTOMER_CREATE_MUTATION = `#graphql
  mutation NewsletterCustomerCreate($input: CustomerInput!) {
    customerCreate(input: $input) {
      customer {
        id
        emailMarketingConsent {
          marketingState
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

// Subscribe an existing customer to email marketing.
export const NEWSLETTER_CONSENT_UPDATE_MUTATION = `#graphql
  mutation NewsletterConsentUpdate(
    $input: CustomerEmailMarketingConsentUpdateInput!
  ) {
    customerEmailMarketingConsentUpdate(input: $input) {
      customer {
        id
        emailMarketingConsent {
          marketingState
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;
