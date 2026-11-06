# 18+Only - Cloudflare Pages Deployment Guide

This project is built with **React + Vite + TypeScript** and is 100% compatible with **Cloudflare Pages**.

---

## 1. Prerequisites
- A Cloudflare account ([dash.cloudflare.com](https://dash.cloudflare.com))
- Your Supabase Project URL and Anon/Publishable Key
- Your GitHub or GitLab repository containing this code

---

## 2. Deploy to Cloudflare Pages (Step-by-Step)

### Step 1: Connect Your Repository
1. Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. In the left navigation, click on **Compute (Workers & Pages)** -> **Pages**.
3. Click **Connect to Git** and choose your repository.

### Step 2: Configure Build Settings
Fill in the build configuration:

| Setting | Value |
| :--- | :--- |
| **Framework preset** | `Vite` |
| **Build command** | `npm run build` |
| **Build output directory** | `dist` |
| **Root directory** | `/` (leave empty or default) |

### Step 3: Add Environment Variables
Under the **Environment variables** section in Cloudflare Pages, add:

| Variable Name | Value | Description |
| :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | `https://your-project.supabase.co` | Your Supabase Project URL |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOi...` | Your Supabase Public / Anon Key |
| `NODE_VERSION` | `20` | Ensures standard modern Node.js build runtime |

> **Security Note:** Never expose the `service_role` key or database password in environment variables starting with `VITE_`. Only use the `anon` key.

### Step 4: Deploy
Click **Save and Deploy**. Cloudflare Pages will install dependencies, compile the Vite applet, and publish your site with a custom `*.pages.dev` domain and free SSL certificate.

---

## 3. SPA Routing Support
The `public/_redirects` file has been automatically created with:
```text
/*    /index.html   200
```
This ensures that direct deep links (e.g. `?v=videoId` and `/admin/siba`) resolve to the single-page application without 404 errors.

---

## 4. Supabase Storage & CORS Configuration
For smooth video streaming from your Supabase `videos` storage bucket:

1. Open your **Supabase Dashboard** -> **Storage**.
2. Ensure the `videos` bucket is set to **Public**.
3. In **Storage Settings** or SQL Editor, ensure CORS allows requests from your Cloudflare Pages domain (or `*` during development).
4. Videos can be referenced by relative path (e.g. `my-clip.mp4`) or full URL (`https://xyz.supabase.co/storage/v1/object/public/videos/my-clip.mp4`).

---

## 5. Supabase Database Tables Required
- `videos` (columns: `id`, `title`, `description`, `video_url`, `thumbnail_url`, `views`, `duration`, `category_id`, `is_published`, `featured`, `author_name`, `created_at`)
- `categories` (columns: `id`, `name`, `slug`, `created_at`)
- `comments` (columns: `id`, `video_id`, `user_name`, `comment_text`, `created_at`)
- `admin_users` (columns: `id`, `email`, `role`, `created_at`)

You can view and copy the full copy-pasteable SQL schema directly from the in-app **Supabase Connection Manager** -> **SQL Schema** tab.
