'use client';

import { ArrowRightCircleIcon, MagnifyingGlassIcon, SparklesIcon, SunIcon } from '@heroicons/react/24/outline';

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
      <Form action="/search" className={`mt-8 justify-center md:w-full`}>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center ">
            <SparklesIcon className="size-6"/>
          </div>
          <input
            key={searchParams?.get('q')}
            name="q"
            placeholder="Continue filtering products..."
            autoComplete="off"
            defaultValue={''}
            className="md:h-14 px-10 md:text-md text-xs w-full border-4 rounded-lg bg-white px-4 py-2 text-black placeholder:text-neutral-500 md:text-sm dark:border-neutral-800 dark:bg-gray-800 dark:text-white dark:placeholder:text-neutral-400 bg-clip-border shadow-[0_0_3px_3px_rgba(67,56,202,0.5)]"
          />
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center ">
            <button type="submit">
              <ArrowRightCircleIcon className="size-8"/>
            </button>
          </div>
        </div>
        <div className='flex items-center justify-between mt-2'>
          <div className="flex gap-2 items-center">
            <p className='italic text-xs'>Powered by Lighthouse</p>
            <SunIcon className="size-6"/>
          </div>
          <button type="submit" className="text-xs underline">See all products</button>  
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
