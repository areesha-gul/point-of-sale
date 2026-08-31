# Deployment Guide - Vercel

## Prerequisites
- A Vercel account (sign up at https://vercel.com)
- Your GitHub repository pushed to GitHub

## Deployment Steps

### 1. Connect GitHub to Vercel

1. Go to https://vercel.com and log in
2. Click "Add New..." → "Project"
3. Import your GitHub repository: `areesha-gul/point-of-sale`
4. Vercel will automatically detect the configuration from `vercel.json`

### 2. Configure Environment Variables

In the Vercel project settings, add these environment variables:

**Required:**
- `SESSION_SECRET` - A random secret string for session encryption (e.g., generate with: `openssl rand -base64 32`)
- `NODE_ENV` - Set to `production`

**Optional:**
- `FRONTEND_URL` - Your Vercel app URL (e.g., `https://your-app.vercel.app`)

### 3. Deploy

1. Click "Deploy"
2. Vercel will:
   - Install frontend dependencies
   - Build the React app
   - Deploy the serverless functions for the backend
   - Create a production URL

### 4. Post-Deployment

After the first deployment:
1. Note your app URL (e.g., `https://your-app.vercel.app`)
2. Update the `FRONTEND_URL` environment variable with this URL
3. Redeploy if needed

## Important Notes

### Database Considerations

⚠️ **IMPORTANT**: The current setup uses SQLite (`sql.js`), which is **NOT persistent** in Vercel's serverless environment. The database will reset on every deployment or function restart.

**For production use, you need to:**

1. **Switch to a persistent database** (Recommended):
   - PostgreSQL (Vercel Postgres, Supabase, Neon)
   - MySQL (PlanetScale, Railway)
   - MongoDB (MongoDB Atlas)

2. **OR use Vercel's built-in storage**:
   - Vercel Postgres (https://vercel.com/docs/storage/vercel-postgres)
   - Vercel KV for session storage

### Session Storage

The current in-memory session storage won't work well with serverless. Consider:
- Using a database-backed session store
- Implementing JWT tokens instead of sessions
- Using Vercel KV for session storage

## Testing Your Deployment

Once deployed, test:
1. Visit your app URL
2. Try logging in (default credentials should be set up in your database initialization)
3. Test creating a sale/purchase
4. Check all features work correctly

## Troubleshooting

### Functions timeout
- Vercel serverless functions have a 10-second timeout on Hobby plan
- Optimize database queries if you hit timeouts

### Database resets
- This is expected with SQLite in serverless
- Migrate to a persistent database solution

### CORS errors
- Ensure `FRONTEND_URL` environment variable is set correctly
- Check that cookies are configured with `sameSite: 'none'` and `secure: true`

## Next Steps for Production

1. **Set up a persistent database**
2. **Configure proper authentication** (JWT or OAuth)
3. **Add error monitoring** (Sentry, LogRocket)
4. **Set up custom domain**
5. **Enable analytics**

## Local Development

To run locally:
```bash
# Install dependencies
npm run install-all

# Run both frontend and backend
npm run dev
```

Frontend: http://localhost:5173
Backend: http://localhost:5000
