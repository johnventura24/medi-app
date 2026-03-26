# Medicare Advantage Analytics Dashboard - Design Guidelines

## Design Approach: Data-Focused Dashboard System

**Selected Approach:** Design System (Carbon Design + Linear-inspired)
**Justification:** Information-dense analytics platform requiring clarity, scanability, and efficient data exploration. Inspired by Linear's clean data presentation and Carbon's enterprise dashboard patterns.

**Core Principles:**
1. Data clarity over decoration
2. Efficient information density
3. Consistent interaction patterns
4. Scannable hierarchies
5. Progressive disclosure of complexity

---

## Typography System

**Font Stack:**
- Primary: Inter (via Google Fonts CDN)
- Monospace: JetBrains Mono (for numerical data)

**Hierarchy:**
- Dashboard titles: font-bold text-3xl
- Section headers: font-semibold text-xl
- Card headers: font-semibold text-lg
- Body text: font-normal text-base
- Data labels: font-medium text-sm
- Metadata/captions: font-normal text-xs
- Large metrics: font-bold text-4xl md:text-5xl (for key statistics)
- Tabular data: font-mono text-sm (numerical values)

---

## Layout System

**Spacing Primitives:** Tailwind units of 3, 4, 6, 8, 12, 16
- Component padding: p-6
- Section spacing: space-y-6 or space-y-8
- Card margins: gap-6 on grid containers
- Page margins: px-6 md:px-8 lg:px-12

**Grid System:**
- Main dashboard: 12-column grid (grid-cols-12)
- Sidebar navigation: 240px fixed width
- Content area: Fluid with max-w-screen-2xl
- Card grids: grid-cols-1 md:grid-cols-2 xl:grid-cols-3 with gap-6
- Data tables: Full-width with horizontal scroll on mobile

**Layout Structure:**
```
[Fixed Sidebar Navigation 240px] [Main Content Area - Fluid]
                                  [Dashboard Header - Full Width]
                                  [Filter Bar - Sticky]
                                  [Primary Content - Max 2xl]
                                  [Cards/Charts Grid]
```

---

## Component Library

### Navigation
**Sidebar Navigation:**
- Fixed left sidebar with grouped menu items
- Collapsible sections for dashboard categories
- Active state indicators on current view
- Icon + label for each menu item (Heroicons)
- Subtle dividers between section groups

**Top Bar:**
- Breadcrumb navigation (State > City > ZIP progression)
- Global search input
- User account dropdown
- Notification bell icon

### Dashboard Components

**Stat Cards:**
- Compact cards displaying key metrics
- Large number (text-4xl font-mono font-bold)
- Label below (text-sm)
- Optional trend indicator (+/- percentage)
- Min height: h-32, padding: p-6

**Data Tables:**
- Sticky headers on scroll
- Sortable columns with chevron indicators
- Row hover states for scanability
- Zebra striping for long tables
- Action buttons/icons in last column
- Pagination footer with rows-per-page selector

**Interactive Maps:**
- Full-width map container with min-h-[500px]
- Side panel for selected region details (w-80)
- Legend overlay in bottom-right
- Zoom controls in top-right
- Search/filter bar above map

**Filter Panels:**
- Sticky position when scrolling (top-20)
- Accordion-style filter groups
- Multi-select dropdowns for categories
- Range sliders for numerical values (copays, allowances)
- Apply/Reset button group at bottom
- Active filter tags displayed above results

**Charts & Visualizations:**
- Container: min-h-[400px] p-6
- Title and description above chart
- Legend positioned to right or below
- Tooltips on hover for data points
- Responsive scaling for mobile

**Comparison Cards:**
- Side-by-side layout for plan comparisons
- Consistent vertical alignment of attributes
- Highlight differences with subtle emphasis
- Expandable details sections

### Forms & Inputs

**Search Bars:**
- Large prominent search: h-12 with icon prefix
- Autocomplete dropdown with recent searches
- Clear button (X) when text present

**Dropdowns/Selects:**
- Height: h-10
- Multi-select with checkbox options
- Search within dropdown for long lists
- Selected count badge

**Toggles & Checkboxes:**
- Standard size toggle switches for binary options
- Checkbox lists for multi-select filters

### Data Presentation

**Benefit Cards:**
- Icon at top (64x64 for benefit type)
- Benefit name (font-semibold text-lg)
- Key metric (text-3xl font-bold font-mono)
- Supporting details list
- CTA link to detailed view

**Heatmap Tables:**
- Grid layout with cells sized consistently
- Intensity conveyed through text weight and opacity variations
- Headers with sorting capabilities
- Cell tooltips showing exact values

**Rankings/Lists:**
- Numbered rankings with large rank number (text-2xl)
- Thumbnail/icon + title + key stats in row
- Score or ranking metric right-aligned
- Expandable details on click

---

## Responsive Behavior

**Breakpoints:**
- Mobile: base (< 768px) - Single column, stacked cards
- Tablet: md (768px+) - 2-column grids, visible sidebar
- Desktop: lg (1024px+) - 3-column grids, full layout
- Large: xl (1280px+) - 4-column grids for stats

**Mobile Adaptations:**
- Sidebar converts to slide-out drawer
- Tables scroll horizontally with sticky first column
- Filter panel becomes modal overlay
- Charts stack vertically
- Reduce padding from p-6 to p-4

---

## Interactive Patterns

**Animations:** Minimal, use only for:
- Dropdown menus (transition-all duration-200)
- Modal overlays (fade in)
- Loading states (pulse or spinner)
- No scroll-triggered animations

**Loading States:**
- Skeleton screens for data tables
- Spinner overlays for charts
- Progress bars for data export

**Empty States:**
- Icon (96x96) centered
- Descriptive message (text-lg)
- Helpful action button or link
- "No data available for selected filters" pattern

---

## Dashboard-Specific Layouts

**View 1: State-Level Heatmap**
- Interactive US map (60% width) + stats sidebar (40% width)
- Grid of top 5 state cards below map

**View 2-3: City/ZIP Reports**
- Filter bar (sticky)
- Sortable data table (full width)
- Export and share controls in header

**Views 4-7: Benefit-Specific**
- Benefit selector tabs at top
- Geographic breakdown (cards or table)
- Comparison chart showing trends

**View 8-9: Carrier/Plan Comparison**
- Side-by-side comparison cards (2-4 columns)
- Attribute checkboxes to show/hide rows
- Winner highlighting for best values

**View 11: Recommendations Dashboard**
- Priority-ranked list of targeting opportunities
- Each recommendation card shows: ZIP/City, angle, reasoning, key metrics
- CTA buttons to export or create campaign

---

## Accessibility
- All interactive elements keyboard navigable
- ARIA labels on all charts and maps
- Focus indicators on all inputs and buttons
- Sufficient contrast for all text (maintain throughout)
- Screen reader announcements for data updates

---

## Icons
**Library:** Heroicons (via CDN)
- Navigation: outline style
- Actions: solid style for buttons
- Data visualization: solid for legends/badges