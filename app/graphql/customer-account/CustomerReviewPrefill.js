// Name and email of the signed-in customer, used only to prefill the
// "Write a review" form for that same customer.
// https://shopify.dev/docs/api/customer/latest/queries/customer
export const CUSTOMER_REVIEW_PREFILL_QUERY = `#graphql
  query CustomerReviewPrefill {
    customer {
      firstName
      lastName
      emailAddress {
        emailAddress
      }
    }
  }
`;
