import { SearchBox } from '../features/search/SearchBox'
import { UserMenu } from './UserMenu'

/** The bar above every page, on the page background: the search box on the left and the
 *  initials button on the right. It's the page's banner, so everything in it is in a landmark. */
export function TopBar() {
  return (
    <header className="mb-6 flex items-center justify-between gap-4">
      <div role="search" aria-label="Search">
        <SearchBox />
      </div>
      <UserMenu />
    </header>
  )
}
