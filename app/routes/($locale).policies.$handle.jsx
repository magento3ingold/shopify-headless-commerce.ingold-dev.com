import {Link, useLoaderData} from 'react-router';
import {useLocalePath} from '~/lib/i18n';
import {
  getPolicyDescription,
  getPolicyField,
  getPolicyIncludeVariables,
  isPolicyConfigured,
} from '~/lib/policies';

/**
 * @type {Route.MetaFunction}
 */
export const meta = ({data, matches}) => {
  if (!data?.policy) return [{title: 'Policy not found'}];

  const root = matches.find((match) => match?.id === 'root');
  const shopName = (root?.loaderData ?? root?.data)?.header?.shop?.name;
  const description = getPolicyDescription(data.policy.body);

  return [
    {
      title: shopName
        ? `${data.policy.title} | ${shopName}`
        : data.policy.title,
    },
    ...(description ? [{name: 'description', content: description}] : []),
  ];
};

/**
 * Renders a Shopify store policy. Handles are mapped explicitly to Storefront
 * API fields (see POLICY_FIELDS_BY_HANDLE in ~/lib/policies); unknown handles
 * and policies that are not configured in Shopify Admin return a 404.
 * @param {Route.LoaderArgs}
 */
export async function loader({params, context}) {
  const field = getPolicyField(params.handle);
  if (!field) {
    throw new Response('Policy not found', {status: 404});
  }

  const {shop} = await context.storefront.query(POLICY_CONTENT_QUERY, {
    variables: getPolicyIncludeVariables(field),
  });

  const policy = shop?.[field];
  if (!isPolicyConfigured(policy)) {
    throw new Response('Policy not found', {status: 404});
  }

  return {policy};
}

export default function Policy() {
  /** @type {LoaderReturnData} */
  const {policy} = useLoaderData();
  const localePath = useLocalePath();

  return (
    <div className="policy page-full-bleed ui-scope">
      <article className="page-width py-12 md:py-16">
        <div className="mx-auto max-w-3xl">
          <Link
            to={localePath('/policies')}
            prefetch="intent"
            className="text-sm font-medium text-muted underline-offset-4 hover:text-ink hover:underline"
          >
            &larr; All policies
          </Link>
          <h1 className="mt-6 font-display text-4xl leading-tight font-medium text-ink md:text-5xl">
            {policy.title}
          </h1>
          {/* Policy content is authored in Shopify Admin > Settings > Policies. */}
          <div
            className="mt-8 text-base leading-relaxed text-ink-soft [&_a]:underline [&_a]:underline-offset-2 [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:mt-8 [&_h3]:mb-2 [&_h3]:text-xl [&_h3]:font-semibold [&_li]:mt-1 [&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mt-4 [&_table]:mt-4 [&_table]:w-full [&_td]:border [&_td]:border-line [&_td]:p-2 [&_th]:border [&_th]:border-line [&_th]:p-2 [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:pl-6"
            dangerouslySetInnerHTML={{__html: policy.body}}
          />
        </div>
      </article>
    </div>
  );
}

// NOTE: https://shopify.dev/docs/api/storefront/latest/objects/Shop
// Only the requested policy is included; the others are skipped by @include.
const POLICY_CONTENT_QUERY = `#graphql
  fragment Policy on ShopPolicy {
    body
    handle
    id
    title
  }
  query Policy(
    $country: CountryCode
    $language: LanguageCode
    $privacyPolicy: Boolean!
    $refundPolicy: Boolean!
    $shippingPolicy: Boolean!
    $termsOfService: Boolean!
    $termsOfSale: Boolean!
    $legalNotice: Boolean!
    $contactInformation: Boolean!
    $subscriptionPolicy: Boolean!
  ) @inContext(language: $language, country: $country) {
    shop {
      privacyPolicy @include(if: $privacyPolicy) {
        ...Policy
      }
      refundPolicy @include(if: $refundPolicy) {
        ...Policy
      }
      shippingPolicy @include(if: $shippingPolicy) {
        ...Policy
      }
      termsOfService @include(if: $termsOfService) {
        ...Policy
      }
      termsOfSale @include(if: $termsOfSale) {
        ...Policy
      }
      legalNotice @include(if: $legalNotice) {
        ...Policy
      }
      contactInformation @include(if: $contactInformation) {
        ...Policy
      }
      subscriptionPolicy @include(if: $subscriptionPolicy) {
        body
        handle
        id
        title
      }
    }
  }
`;

/** @typedef {import('./+types/policies.$handle').Route} Route */
/** @typedef {ReturnType<typeof useLoaderData<typeof loader>>} LoaderReturnData */
