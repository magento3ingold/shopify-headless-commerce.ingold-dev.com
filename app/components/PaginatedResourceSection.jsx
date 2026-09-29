import * as React from 'react';
import {Pagination} from '@shopify/hydrogen';

const PAGINATION_LINK_CLASSES =
  'inline-flex items-center gap-2 rounded-full border border-line px-6 py-3 text-sm font-semibold text-ink no-underline transition-colors duration-200 hover:border-ink hover:no-underline';

/**
 * <PaginatedResourceSection> encapsulates the previous and next pagination behaviors throughout your application.
 * @param {Class<Pagination<NodesType>>['connection']>}
 */
export function PaginatedResourceSection({
  connection,
  children,
  ariaLabel,
  resourcesClassName,
}) {
  return (
    <Pagination connection={connection}>
      {({nodes, isLoading, PreviousLink, NextLink}) => {
        const resourcesMarkup = nodes.map((node, index) =>
          children({node, index}),
        );

        return (
          <div>
            <div className="mb-8 flex justify-center empty:hidden">
              <PreviousLink className={PAGINATION_LINK_CLASSES}>
                {isLoading ? (
                  'Loading...'
                ) : (
                  <span>
                    <span aria-hidden="true">↑</span> Load previous
                  </span>
                )}
              </PreviousLink>
            </div>
            {resourcesClassName ? (
              <div
                aria-label={ariaLabel}
                className={resourcesClassName}
                role={ariaLabel ? 'region' : undefined}
              >
                {resourcesMarkup}
              </div>
            ) : (
              resourcesMarkup
            )}
            <div className="mt-12 flex justify-center empty:hidden">
              <NextLink className={PAGINATION_LINK_CLASSES}>
                {isLoading ? (
                  'Loading...'
                ) : (
                  <span>
                    Load more <span aria-hidden="true">↓</span>
                  </span>
                )}
              </NextLink>
            </div>
          </div>
        );
      }}
    </Pagination>
  );
}
