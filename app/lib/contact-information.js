import {useRouteLoaderData} from 'react-router';

/**
 * Global store contact details from the "Contact Information" metaobject
 * (type `contact_information`, first entry), managed in Shopify Admin:
 * Content > Metaobjects > Contact Information.
 *
 * Loaded once per request by the root loader (HEADER_QUERY) and exposed as
 * `contactInformation` in the root loader data. Read it anywhere with
 * useContactInformation() — footer, contact page, header, about page...
 */
export const CONTACT_INFORMATION_FRAGMENT = `#graphql
  fragment ContactInformation on Metaobject {
    id
    email: field(key: "email") {
      value
    }
    phone: field(key: "phone") {
      value
    }
    address: field(key: "address") {
      value
    }
  }
`;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Normalizes the first entry into display- and link-ready values. Missing or
 * invalid fields become null so components can simply skip them.
 * @param {ContactInformationFragment | null | undefined} node
 * @return {ContactInformation}
 */
export function getContactInformation(node) {
  const email = node?.email?.value?.trim();
  const phone = node?.phone?.value?.trim();
  const addressLines = (node?.address?.value ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return {
    email:
      email && EMAIL_PATTERN.test(email)
        ? {value: email, href: `mailto:${email}`}
        : null,
    phone: toPhone(phone),
    address: addressLines.length ? {lines: addressLines} : null,
  };
}

/**
 * Keeps the number as entered for display and builds a dialable tel: link
 * (digits plus a leading "+"), so spaces or punctuation cannot break it.
 * @param {string | undefined} value
 */
function toPhone(value) {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  if (digits.length < 3) return null;
  const dialable = value.trimStart().startsWith('+') ? `+${digits}` : digits;
  return {value, href: `tel:${dialable}`};
}

/**
 * Contact Information from the root loader, for use in any component.
 * @return {ContactInformation}
 */
export function useContactInformation() {
  /** @type {{contactInformation?: ContactInformation} | undefined} */
  const data = useRouteLoaderData('root');
  return data?.contactInformation ?? EMPTY_CONTACT_INFORMATION;
}

/** @type {ContactInformation} */
const EMPTY_CONTACT_INFORMATION = {email: null, phone: null, address: null};

/**
 * @typedef {{
 *   email: {value: string; href: string} | null;
 *   phone: {value: string; href: string} | null;
 *   address: {lines: string[]} | null;
 * }} ContactInformation
 */

/** @typedef {import('storefrontapi.generated').ContactInformationFragment} ContactInformationFragment */
