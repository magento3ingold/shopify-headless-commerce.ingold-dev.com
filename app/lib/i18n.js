import {useCallback} from 'react';
import {useLocation} from 'react-router';
import {LOCALE_PATH_SEGMENT} from '~/lib/links';

/**
 * @param {Request} request
 */
export function getLocaleFromRequest(request) {
  const url = new URL(request.url);
  const firstPathPart = url.pathname.split('/')[1]?.toUpperCase() ?? '';

  let pathPrefix = '';
  let [language, country] = ['EN', 'US'];

  if (/^[A-Z]{2}-[A-Z]{2}$/i.test(firstPathPart)) {
    pathPrefix = '/' + firstPathPart;
    [language, country] = firstPathPart.split('-');
  }

  return {language, country, pathPrefix};
}

const LOCALE_SEGMENT = LOCALE_PATH_SEGMENT;

/**
 * Returns the market subfolder of a pathname, e.g. `/en-ca` for
 * `/en-ca/products/shirt`, or an empty string for the default market.
 * @param {string} pathname
 */
export function getPathPrefix(pathname) {
  const match = LOCALE_SEGMENT.exec(pathname);
  return match ? `/${match[1]}` : '';
}

/**
 * Prefixes an internal, root-relative path with the market subfolder.
 * External URLs, protocol-relative URLs and hash/query-only links are
 * returned unchanged.
 * @param {string} path
 * @param {string} prefix
 */
export function localizePath(path, prefix) {
  if (!prefix || !path.startsWith('/') || path.startsWith('//')) return path;
  if (getPathPrefix(path)) return path;
  return path === '/' ? prefix : `${prefix}${path}`;
}

/**
 * Hook returning a function that localizes internal paths for the market the
 * visitor is currently browsing, so links never drop them back to the default
 * market.
 */
export function useLocalePath() {
  const {pathname} = useLocation();
  const prefix = getPathPrefix(pathname);
  return useCallback((path) => localizePath(path, prefix), [prefix]);
}

/**
 * @typedef {Object} I18nLocale
 * @property {string} pathPrefix
 */

/** @typedef {import('@shopify/hydrogen').I18nBase} I18nBase */
