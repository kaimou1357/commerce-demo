'use client';

import { ArrowRightCircleIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

import Form from 'next/form';
import { usePathname, useSearchParams } from 'next/navigation';


export default function NavbarSearch() {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const isSearchPage = pathname === '/search'

  return (
    <Form action="/search" className={`relative w-full max-w-[550px] lg:w-80 xl:w-full 
      ${isSearchPage ? 'hidden' : ''}`}>
    <input
      key={searchParams?.get('q')}
      type="text"
      name="q"
      placeholder="Search for products..."
      autoComplete="off"
      defaultValue={searchParams?.get('q') || ''}
      className="px-6 text-md w-full border-4 rounded-lg bg-white px-4 py-2 text-black placeholder:text-neutral-500 md:text-sm dark:border-neutral-800 dark:bg-transparent dark:text-white dark:placeholder:text-neutral-400 bg-clip-border
    shadow-[0_0_3px_3px_rgba(67,56,202,0.5)]"
    />
    <div className="absolute left-2 top-0 mr-3 flex h-full items-center">
      <MagnifyingGlassIcon className="h-4" />
    </div>
  </Form>
  );
}

export function StickySearch() {
  const searchParams = useSearchParams();
  return (
      <Form action="/search" className={`fixed bottom-0 left-0 w-1/2 justify-center left-1/2 -translate-x-1/2 -translate-y-1/2 min-h-4`}>
      <div className="relative w-full">
        <textarea
          key={searchParams?.get('q')}
          name="q"
          placeholder="Continue filtering products..."
          autoComplete="off"
          defaultValue={''}
          className="h-32 px-6 text-md w-full border-4 rounded-lg bg-white px-4 py-2 text-black placeholder:text-neutral-500 md:text-sm dark:border-neutral-800 dark:bg-transparent dark:text-white dark:placeholder:text-neutral-400 bg-clip-border shadow-[0_0_3px_3px_rgba(67,56,202,0.5)]"
        />
        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center">
          <ArrowRightCircleIcon className="size-8" />
        </div>
      </div>
    </Form>
  );
}


export function SearchSkeleton() {
  return (
    <form className="w-max-[550px] relative w-full lg:w-80 xl:w-full">
      <input
        placeholder="Search for products..."
        className="w-full rounded-lg border bg-white px-4 py-2 text-sm text-black placeholder:text-neutral-500 dark:border-neutral-800 dark:bg-transparent dark:text-white dark:placeholder:text-neutral-400"
      />
      <div className="absolute right-0 top-0 mr-3 flex h-full items-center">
        <MagnifyingGlassIcon className="h-4" />
      </div>
    </form>
  );
}
