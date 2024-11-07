import { SparklesIcon } from '@heroicons/react/24/outline';
import { SortFilterItem } from 'lib/constants';
import { Suspense } from 'react';
import FilterItemDropdown from './dropdown';
import { FilterItem } from './item';

export type ListItem = SortFilterItem | PathFilterItem;
export type PathFilterItem = { title: string; path: string };

function FilterItemList({ list }: { list: ListItem[] }) {
  return (
    <>
      {list.map((item: ListItem, i) => (
        <FilterItem key={i} item={item} />
      ))}
    </>
  );
}

export default function FilterList({ list, title }: { list: ListItem[]; title?: string }) {
  return (
    <>
      <nav>
        <div className="flex gap-2">
          <SparklesIcon className="size-4"/>
          {title ? (
          <h3 className="text-xs mb-2 text-neutral-500 md:block dark:text-neutral-400">
            {title}
          </h3>
        ) : null}
        </div>
        <ul className="hidden md:block">
          <Suspense fallback={null}>
            <FilterItemList list={list} />
          </Suspense>
        </ul>
        <ul className="md:hidden">
          <Suspense fallback={null}>
            <FilterItemDropdown list={list} />
          </Suspense>
        </ul>
      </nav>
    </>
  );
}
