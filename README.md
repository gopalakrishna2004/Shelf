# Shelf

> **Everything worth keeping.**

Shelf is an elegant, distraction-free personal bookmark manager designed for readers, researchers, and curators. Built with an editorial aesthetic, Shelf provides a tactile, quiet corner of the internet to organize thoughtful essays, engineering references, utilities, and design inspirations without algorithmic noise.

---

## Features

- **Tactile Curation**: Save bookmarks with automatic metadata extraction, domain derivation, and favicon discovery.
- **Editorial Design System**: Bespoke visual design with warm paper and espresso color palettes, Cormorant Garamond / Newsreader typography, and custom fallback library plates for links without preview images.
- **Organization & Shelves**: Group bookmarks into dedicated **Collections** (shelves) and cross-cutting **Tags**.
- **Instant Search & Multi-Criteria Filtering**: Filter dynamically across collections, tags, and full-text queries matching titles, URLs, and personal notes.
- **Flexible Sorting**: Sort bookmarks by Newest First, Oldest First, Title (A → Z), or Title (Z → A) with deterministic secondary tie-breaking.
- **Dual Display Modes**: Toggle between visual **Grid Cards** with branded preview plates and dense **List Rows** for high-volume archiving.
- **Theme Support**: Seamless Light, Dark, and System theme switching with zero flash-of-unstyled-content.
- **Keyboard & Screen-Reader Accessible**: Comprehensive WCAG accessibility, including full keyboard navigation, focus trapping in modal dialogs, and accessible action menus.
- **Cloud-Authoritative Persistence**: Built on Supabase PostgreSQL with strict Row Level Security (RLS) ensuring each user's data remains private and secure.

---

## Screenshots

> *Visual preview placeholders — Replace with production screenshots after deployment.*

```
+--------------------------------------------------------------------------+
|  [Screenshot Placeholder: All Bookmarks Grid View (Dark Theme)]          |
|  Displays the tactile sidebar, search toolbar, and editorial link cards. |
+--------------------------------------------------------------------------+
```

```
+--------------------------------------------------------------------------+
|  [Screenshot Placeholder: Collections & Reading Shelves]                 |
|  Shows curated collection categories with custom badge counters.         |
+--------------------------------------------------------------------------+
```

```
+--------------------------------------------------------------------------+
|  [Screenshot Placeholder: Bookmark Curator Modal]                        |
|  Modal dialog featuring inline tagging, shelf selection, and notes.      |
+--------------------------------------------------------------------------+
```

---

## Technology Stack

- **Frontend Core**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Bundler & Tooling**: [Vite 6](https://vitejs.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) with custom typography and tactile design tokens
- **Icons**: [Lucide React](https://lucide.dev/)
- **Backend & Authentication**: [Supabase](https://supabase.com/) (PostgreSQL database, Supabase Auth via PKCE, Row Level Security)
- **Routing**: Client-side hash-based routing for robust zero-config static hosting
- **Testing**: [Vitest](https://vitest.dev/) + [React Testing Library](https://testing-library.com/) (410 unit and integration tests)

---

## Architecture Overview

Shelf follows an **online-only, desktop-first cloud persistence model**:
- **Authoritative Cloud Database**: Supabase PostgreSQL serves as the single source of truth. Mutations and queries use standard HTTPS REST calls via `@supabase/supabase-js`.
- **Repository Pattern**: Data services are decoupled behind clean interfaces (`IBookmarkRepository`, `ICollectionRepository`, `ITagRepository`).
- **Protected Routing**: Hash-based routes (`#all`, `#favourites`, `#collections`, `#tags`, `#settings`) prevent 404 errors on static CDNs, while `<MigrationGate>` guarantees safe cutover before rendering the user canvas.
- **Security by Design**: Row Level Security (RLS) ensures tenant isolation directly in PostgreSQL. Client requests only execute with the authenticated user's JWT.

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18.0.0 or later recommended)
- [npm](https://www.npmjs.com/) (bundled with Node.js)
- A free [Supabase](https://supabase.com/) account and project

### 1. Clone the Repository

```bash
git clone https://github.com/<your-username>/shelf.git
cd shelf
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Open `.env` and fill in your Supabase project credentials:

```ini
# Supabase Configuration
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your-supabase-publishable-key>
```

> **Note:** The publishable key (or `anon` key) is safe for client-side use in web browsers. Never add administrative or service-role keys here.

---

## Database Setup (Supabase)

To provision your database tables, indexes, and Row Level Security policies:

1. Open your project in the [Supabase Dashboard](https://supabase.com/dashboard).
2. Navigate to the **SQL Editor** from the left navigation menu.
3. Open the migration file: [`supabase/migrations/20261118_stage5_cloud_persistence.sql`](./supabase/migrations/20261118_stage5_cloud_persistence.sql).
4. Copy and paste the entire script into the SQL Editor, then click **Run**.

This migration script establishes:
- `public.collections` — Shelves for organizing bookmarks.
- `public.tags` — Reusable labels.
- `public.bookmarks` — User bookmarks with metadata, URLs, and notes.
- Row Level Security (RLS) policies granting read, insert, update, and delete access strictly to the authenticated record owner (`auth.uid() = user_id`).

---

## Development & Build Commands

| Command | Action |
| :--- | :--- |
| `npm run dev` | Start the local Vite development server at `http://localhost:5174` |
| `npm test` | Execute the Vitest suite across all 32 test suites (410 tests) |
| `npm run build` | Perform TypeScript type checking (`tsc -b`) and bundle for production via Vite |
| `npm run preview` | Locally preview the generated production build from `dist/` |

---

## Deployment (Vercel)

Shelf is fully optimized for static deployment on [Vercel](https://vercel.com/):

### Step 1: Deploy to Vercel
1. Push your repository to GitHub.
2. Import the repository in your Vercel Dashboard.
3. Vercel automatically detects the **Vite** framework preset:
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`
4. Add the following **Environment Variables** in Vercel:
   - `VITE_SUPABASE_URL` = `https://<your-project-ref>.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = `<your-supabase-publishable-key>`
5. Click **Deploy**.

### Step 2: Configure Supabase Authentication Redirects
Because Shelf uses hash-based routing (`/#all`, `/#favourites`, etc.), all client routes resolve without server-side rewrite rules.

To allow email confirmation, password recovery, and Google OAuth redirects:
1. Go to your **Supabase Dashboard** > **Authentication** > **URL Configuration**.
2. Set **Site URL** to your Vercel URL (e.g. `https://your-shelf-deployment.vercel.app`).
3. Add the following to **Redirect URLs**:
   - `https://your-shelf-deployment.vercel.app/**`
   - `https://your-shelf-deployment.vercel.app`
   - `http://localhost:5174/**` (for local development)
4. Save changes.

---

## Security Architecture

- **Zero Client Secrets**: The frontend application exclusively uses the public Supabase publishable / anon key.
- **Never Expose Service-Role Keys**: Under no circumstances should `SUPABASE_SERVICE_ROLE_KEY` or any administrative secret be prefixed with `VITE_` or added to `.env`. Vite embeds all `VITE_*` variables directly into public JavaScript bundles.
- **Server-Side Edge Functions**: Administrative operations (such as complete account deletion via `auth.admin.deleteUser`) are isolated in a separate, server-side Supabase Edge Function ([`supabase/functions/delete-account`](./supabase/functions/delete-account)) with origin validation and caller JWT verification.

---

## License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.
