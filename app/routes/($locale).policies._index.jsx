import {useLoaderData, Link} from 'react-router';
import {useLocalePath} from '~/lib/i18n';
import {POLICY_FIELDS, getPolicyField} from '~/lib/policies';

/**
 * @param {Route.LoaderArgs}
 */
export async function loader({context}) {
  const data = await context.storefront.query(POLICIES_QUERY);

  // Same order and handle mapping as the /policies/:handle route, so every
  // listed policy resolves there.
  const policies = POLICY_FIELDS.map((field) => data.shop?.[field]).filter(
    (policy) => policy?.handle && getPolicyField(policy.handle),
  );

  if (!policies.length) {
    throw new Response('No policies found', {status: 404});
  }

  return {policies};
}

export default function Policies() {
  /** @type {LoaderReturnData} */
  const {policies} = useLoaderData();
  const localePath = useLocalePath();

  return (
    <div className="policies">
      <h1>Policies</h1>
      <div>
        {policies.map((policy) => (
          <fieldset key={policy.handle}>
            <Link to={localePath(`/policies/${policy.handle}`)}>
              {policy.title}
            </Link>
          </fieldset>
        ))}
      </div>
    </div>
  );
}

const POLICIES_QUERY = `#graphql
  fragment PolicyItem on ShopPolicy {
    id
    title
    handle
  }
  query Policies ($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    shop {
      privacyPolicy {
        ...PolicyItem
      }
      refundPolicy {
        ...PolicyItem
      }
      shippingPolicy {
        ...PolicyItem
      }
      termsOfService {
        ...PolicyItem
      }
      termsOfSale {
        ...PolicyItem
      }
      legalNotice {
        ...PolicyItem
      }
      contactInformation {
        ...PolicyItem
      }
      subscriptionPolicy {
        id
        title
        handle
      }
    }
  }
`;

/** @typedef {import('./+types/policies._index').Route} Route */
/** @typedef {import('storefrontapi.generated').PoliciesQuery} PoliciesQuery */
/** @typedef {import('storefrontapi.generated').PolicyItemFragment} PolicyItemFragment */
/** @typedef {ReturnType<typeof useLoaderData<typeof loader>>} LoaderReturnData */
