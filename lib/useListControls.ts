import { useMemo, useState } from "react";

const PAGE_SIZE = 10;

// ponytail: client-side sort/paginate over an already-fetched array — fine for the small,
// per-scope lists this hook is used on. Swap for server-side skip/take if a list grows past
// a few hundred rows. Filtering stays page-local since match fields differ per list.
export function useListControls<T>(items: T[], sortFn: (a: T, b: T, dir: "asc" | "desc") => number) {
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  const sorted = useMemo(() => [...items].sort((a, b) => sortFn(a, b, sortDir)), [items, sortDir, sortFn]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages);
  const pageItems = sorted.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE);

  return {
    sortDir,
    setSortDir: (v: "asc" | "desc") => {
      setSortDir(v);
      setPage(1);
    },
    page: clampedPage,
    setPage,
    totalPages,
    total: sorted.length,
    pageItems,
    pageSize: PAGE_SIZE,
  };
}
