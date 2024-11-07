import Grid from 'components/grid';
import ProductGridItems from 'components/layout/product-grid-items';
import { defaultSort, sorting } from 'lib/constants';
import { getProducts } from 'lib/shopify';
import { getFilteredProducts } from './action';

export const metadata = {
  title: 'Search',
  description: 'Search for products in the store.'
};

export default async function SearchPage(props: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = await props.searchParams;
  const { sort, q: searchValue } = searchParams as { [key: string]: string };
  const { sortKey, reverse } = sorting.find((item) => item.slug === sort) || defaultSort;
  const products = await getProducts({ sortKey, reverse, query: '' });
  const filteredProducts = await getFilteredProducts(products, searchValue);
  const resultsText = products.length > 1 ? 'results' : 'result';
  
  return (
    <>
      {searchValue ? (
        <p className="mb-4">
          {filteredProducts.length === 0
            ? 'There are no products that match '
            : `Showing ${filteredProducts.length} ${resultsText} for `}
          <span className="font-bold">&quot;{searchValue}&quot;</span>
        </p>
      ) : null}
      {filteredProducts.length > 0 ? (
        <Grid className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <ProductGridItems products={filteredProducts} />
        </Grid>
      ) : null}
    </>
  );
}
