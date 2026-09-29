import {Link} from 'react-router';
import {Image} from '@shopify/hydrogen';
import {useLocalePath} from '~/lib/i18n';
import {ArrowRightIcon} from '~/components/Icons';

/**
 * @param {{
 *   collection: CollectionCardFragment;
 *   loading?: 'eager' | 'lazy';
 * }}
 */
export function CollectionCard({collection, loading = 'lazy'}) {
  const localePath = useLocalePath();
  const {image} = collection;

  return (
    <Link
      to={localePath(`/collections/${collection.handle}`)}
      prefetch="intent"
      className="ui-scope group block"
    >
      <div className="relative aspect-[4/5] overflow-hidden rounded-card bg-surface">
        {image ? (
          <Image
            data={image}
            alt={image.altText || collection.title}
            aspectRatio="4/5"
            loading={loading}
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
            className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex size-full items-center justify-center font-display text-5xl text-muted/40">
            {collection.title.charAt(0)}
          </div>
        )}
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <h3 className="text-base font-medium text-ink md:text-lg">
          {collection.title}
        </h3>
        <ArrowRightIcon className="size-4 shrink-0 text-ink transition-transform duration-200 group-hover:translate-x-1" />
      </div>
    </Link>
  );
}

/** @typedef {import('storefrontapi.generated').CollectionCardFragment} CollectionCardFragment */
