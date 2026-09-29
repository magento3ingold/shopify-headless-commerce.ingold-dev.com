import {useLocation} from 'react-router';
import {useMemo} from 'react';
import {getPathPrefix} from '~/lib/i18n';

/**
 * @param {string} handle
 * @param {SelectedOption[]} [selectedOptions]
 */
export function useVariantUrl(handle, selectedOptions) {
  const {pathname} = useLocation();

  return useMemo(() => {
    return getVariantUrl({
      handle,
      pathname,
      searchParams: new URLSearchParams(),
      selectedOptions,
    });
  }, [handle, selectedOptions, pathname]);
}

/**
 * @param {{
 *   handle: string;
 *   pathname: string;
 *   searchParams: URLSearchParams;
 *   selectedOptions?: SelectedOption[];
 * }}
 */
export function getVariantUrl({
  handle,
  pathname,
  searchParams,
  selectedOptions,
}) {
  // Also matches the bare market root (e.g. `/en-ca`), not only `/en-ca/...`
  const path = `${getPathPrefix(pathname)}/products/${handle}`;

  selectedOptions?.forEach((option) => {
    searchParams.set(option.name, option.value);
  });

  const searchString = searchParams.toString();

  return path + (searchString ? '?' + searchParams.toString() : '');
}

/** @typedef {import('@shopify/hydrogen/storefront-api-types').SelectedOption} SelectedOption */
