import {CollectionCard} from '~/components/CollectionCard';

export const COLLECTION_GRID_CLASSES =
  'grid grid-cols-1 gap-x-6 gap-y-10 min-[420px]:grid-cols-2 lg:grid-cols-4';

/**
 * @param {{
 *   collections: CollectionCardFragment[];
 *   eagerCount?: number;
 * }}
 */
export function CollectionGrid({collections, eagerCount = 0}) {
  return (
    <ul className={`ui-scope ${COLLECTION_GRID_CLASSES}`}>
      {collections.map((collection, index) => (
        <li key={collection.id}>
          <CollectionCard
            collection={collection}
            loading={index < eagerCount ? 'eager' : 'lazy'}
          />
        </li>
      ))}
    </ul>
  );
}

/** @typedef {import('storefrontapi.generated').CollectionCardFragment} CollectionCardFragment */
