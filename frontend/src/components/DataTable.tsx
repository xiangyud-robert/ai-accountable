import {
  columnFilteringFeature,
  createFilteredRowModel,
  createSortedRowModel,
  globalFilteringFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type ColumnDef,
  type FilterFn,
  type RowData,
  type SortingState,
} from '@tanstack/react-table'
import { ArrowDown, ArrowUp, Pencil, Search, Trash2 } from 'lucide-react'
import { useDeferredValue, useMemo, useState, type ReactNode } from 'react'
import { IconButton } from './Button'
import { EmptyState } from './EmptyState'

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  columnFilteringFeature,
  globalFilteringFeature,
  filteredRowModel: createFilteredRowModel(),
})
type Features = typeof features

type Value = string | number | null

export type Column<T> = {
  id: string
  header: string
  /** The value it sorts by. */
  value: (row: T) => Value
  /** The text the search matches, as shown on screen. The value is used if there's none. */
  text?: (row: T) => string
  cell?: (row: T) => ReactNode
  /** For an order that isn't alphabetical, such as stages in pipeline order. */
  compare?: (a: T, b: T) => number
  /** A figure: right-aligned, in the mono font. */
  numeric?: boolean
}

type DataTableProps<T extends RowData> = {
  /** The table's name for screen readers, such as "Deals". */
  label: string
  rows: T[]
  columns: Column<T>[]
  /** Such as ["deal", "deals"], for "12 of 36 deals". */
  noun: [string, string]
  initialSort: { id: string; desc?: boolean }
  rowId: (row: T) => number
  rowName: (row: T) => string
  onEdit: (row: T) => void
  onDelete: (row: T) => void
  /** Shown beside the search, such as the contacts' status filter. */
  toolbar?: ReactNode
  /** Shown when there are no rows at all, such as an Add button. */
  emptyAction?: ReactNode
}

// Empty values sort last in both directions. The table turns the comparison around for
// descending, so they're handed to it as undefined, which sortUndefined: 'last' keeps last.
const sortValue = (value: Value) => (value === null || value === '' ? undefined : value)

function compareValues(a: Value, b: Value): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), 'en', { sensitivity: 'base', numeric: true })
}

const columnText = <T,>(column: Column<T>, row: T) => (column.text ? column.text(row) : String(column.value(row) ?? ''))

/** A real HTML table with search, sorting by any column, a row count, and Edit and Delete
 *  on every row (R13). Rows load all at once, which is fine for hundreds. */
export function DataTable<T extends RowData>({
  label,
  rows,
  columns,
  noun,
  initialSort,
  rowId,
  rowName,
  onEdit,
  onDelete,
  toolbar,
  emptyAction,
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([{ id: initialSort.id, desc: !!initialSort.desc }])
  const [query, setQuery] = useState('')
  // Typing stays quick with hundreds of rows: the table catches up a moment later.
  const search = useDeferredValue(query.trim())

  const byId = useMemo(() => new Map(columns.map((c) => [c.id, c])), [columns])

  const tableColumns = useMemo<ColumnDef<Features, T>[]>(
    () =>
      columns.map((column) => ({
        id: column.id,
        header: column.header,
        accessorFn: (row: T) => sortValue(column.value(row)),
        sortUndefined: 'last' as const,
        sortFn: (a, b) =>
          column.compare
            ? column.compare(a.original, b.original)
            : compareValues(column.value(a.original), column.value(b.original)),
      })),
    [columns],
  )

  const matches = useMemo<FilterFn<Features, T>>(
    () => (row, columnId, filterValue: string) => {
      const column = byId.get(columnId)
      return !!column && columnText(column, row.original).toLowerCase().includes(filterValue.toLowerCase())
    },
    [byId],
  )

  const table = useTable({
    features,
    columns: tableColumns,
    data: rows,
    getRowId: (row) => String(rowId(row)),
    state: { sorting, globalFilter: search },
    onSortingChange: setSorting,
    onGlobalFilterChange: setQuery,
    globalFilterFn: matches,
    getColumnCanGlobalFilter: () => true,
    enableSortingRemoval: false,
    enableMultiSort: false,
    sortDescFirst: false,
  })

  const shown = table.getRowModel().rows
  const [singular, plural] = noun
  const count = search
    ? `${shown.length} of ${rows.length} ${rows.length === 1 ? singular : plural}`
    : `${rows.length} ${rows.length === 1 ? singular : plural}`

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="relative w-72">
          <Search
            aria-hidden
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
          />
          <input
            type="search"
            aria-label={`Search ${plural}`}
            placeholder={`Search ${plural}`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-9 w-full rounded-control border border-field bg-panel pl-9 pr-3 text-sm placeholder:text-ink-muted"
          />
        </div>
        {toolbar}
        <p className="ml-auto text-[13px] text-ink-muted" aria-live="polite">
          {count}
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState message={`No ${plural} yet.`} action={emptyAction} />
      ) : (
        <table aria-label={label} className="w-full border-collapse text-sm">
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => {
                  const column = byId.get(header.column.id)!
                  const sorted = header.column.getIsSorted()
                  const Arrow = sorted === 'asc' ? ArrowUp : ArrowDown
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : 'none'}
                      className={`h-10 whitespace-nowrap px-2.5 text-[13px] font-medium text-ink-muted first:min-w-52 first:pl-0 ${column.numeric ? 'text-right' : 'text-left'}`}
                    >
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className={`inline-flex items-center gap-1 rounded-control hover:text-ink ${column.numeric ? 'flex-row-reverse' : ''}`}
                      >
                        {column.header}
                        {sorted && <Arrow aria-hidden size={14} />}
                      </button>
                    </th>
                  )
                })}
                <th scope="col" className="w-20 px-2.5 pr-0">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            ))}
          </thead>
          <tbody>
            {shown.map((row) => (
              <tr key={row.id} className="border-t border-divider hover:bg-page">
                {row.getAllCells().map((cell) => {
                  const column = byId.get(cell.column.id)!
                  return (
                    <td
                      key={cell.id}
                      className={`h-11 px-2.5 py-1.5 first:pl-0 ${column.numeric ? 'whitespace-nowrap text-right font-mono text-[13px]' : ''}`}
                    >
                      {column.cell ? column.cell(row.original) : column.value(row.original)}
                    </td>
                  )
                })}
                <td className="h-11 px-2.5 pr-0">
                  <div className="flex justify-end gap-1">
                    <IconButton
                      label={`Edit ${rowName(row.original)}`}
                      tooltip="Edit"
                      onClick={() => onEdit(row.original)}
                    >
                      <Pencil aria-hidden size={16} />
                    </IconButton>
                    <IconButton
                      label={`Delete ${rowName(row.original)}`}
                      tooltip="Delete"
                      onClick={() => onDelete(row.original)}
                    >
                      <Trash2 aria-hidden size={16} />
                    </IconButton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {rows.length > 0 && shown.length === 0 && (
        <p className="border-t border-divider py-8 text-center text-ink-muted">
          No {plural} match "{search}".
        </p>
      )}
    </div>
  )
}
