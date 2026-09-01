# Render.com Backend Deployment Guide

## Step 1: Commit and Push Changes

The changes have been prepared. Now commit and push:

```bash
git add .
git commit -m "Configure backend for Render deployment"
git push
```

## Step 2: Create Render Account

1. Go to https://render.com
2. Click "Get Started" or "Sign Up"
3. Sign up with GitHub (recommended) or email

## Step 3: Deploy Backend to Render

1. After logging in, click "New +" button
2. Select "Web Service"
3. Connect your GitHub repository: `areesha-gul/point-of-sale`
4. Render will detect the `render.yaml` file

### Configuration:

**Basic Settings:**
- Name: `pos-backend` (or your choice)
- Region: Choose closest to your users (Oregon, Frankfurt, Singapore, etc.)
- Branch: `main`
- Root Directory: Leave empty
- Environment: `Node`
- Build Command: `cd backend && npm install`
- Start Command: `cd backend && npm start`

**Plan:**
- Select: **Free** (750 hours/month)

**Environment Variables:**
These should auto-populate from render.yaml, but verify:
- `NODE_ENV` = `production`
- `PORT` = `5000` (Render may override this)
- `SESSION_SECRET` = (click "Generate Value")
- `DB_PATH` = `/opt/render/project/src/backend/database/pos.db`

5. Click "Create Web Service"

## Step 4: Wait for Deployment

- First deployment takes 2-5 minutes
- Watch the logs for any errors
- Look for: "Server running on port XXXX"
- Once deployed, you'll get a URL like: `https://pos-backend-xxxx.onrender.com`

## Step 5: Initialize the Database

After the backend is deployed, initialize the database:

1. Go to your Render service dashboard
2. Click "Shell" tab (left sidebar)
3. Run these commands:
```bash
cd backend
node database/init.js
```

You should see:
```
✓ Database schema created successfully
✓ Default admin user created
✓ Default cash account created
```

## Step 6: Configure Vercel Frontend

Now we need to tell the frontend where the backend is:

1. Go to your Vercel dashboard
2. Select your `point-of-sale-frontend` project
3. Go to Settings → Environment Variables
4. Add a new variable:
   - **Name:** `VITE_API_URL`
   - **Value:** `https://your-backend-url.onrender.com/api`
   - (Replace with your actual Render URL from Step 4)
5. Click "Save"

## Step 7: Redeploy Frontend

1. Go to Deployments tab in Vercel
2. Find the latest deployment
3. Click the three dots (•••) → "Redeploy"
4. Check "Use existing Build Cache" → Click "Redeploy"

## Step 8: Test Your Application

1. Go to your Vercel frontend URL
2. Try logging in:
   - Username: `admin`
   - Password: `admin123`
3. If successful, you should see the dashboard!

---

## Important Notes

### Free Tier Limitations

**Render Free Tier:**
- Backend sleeps after 15 minutes of inactivity
- First request after sleeping takes 30-60 seconds to wake up
- 750 hours/month (enough for personal use)

**Workaround:** Use a service like UptimeRobot or cron-job.org to ping your backend every 10 minutes to keep it awake.

### Database Persistence

- SQLite database file is stored in the Render service
- Data persists across restarts
- BUT: Free tier services can be deleted after 90 days of inactivity
- **Backup recommendation:** Set up periodic exports

### CORS Issues

If you see CORS errors:
1. Check that backend logs show the request
2. Verify `VITE_API_URL` in Vercel includes `/api` at the end
3. Check browser console for exact error

---

## Troubleshooting

### Backend won't start
- Check Render logs for error messages
- Verify all dependencies are in backend/package.json
- Check that DB_PATH is correct

### "Cannot POST /api/auth/login"
- Database not initialized → Run init.js in Render Shell
- Backend is asleep → Wait 30-60 seconds for wake up

### CORS errors
- Add your Vercel URL to backend CORS configuration
- Ensure `withCredentials: true` in frontend API calls

### Database resets
- This shouldn't happen on Render unlike Vercel
- If it does, check Render logs for file system errors

---

## Production Checklist

- [ ] Backend deployed to Render
- [ ] Database initialized
- [ ] Frontend environment variable set
- [ ] Frontend redeployed
- [ ] Login works
- [ ] Can create customers/vendors
- [ ] Can create sales/purchases
- [ ] Change admin password
- [ ] Set up uptime monitoring (optional)
- [ ] Set up database backups (recommended)

---

## Cost Summary

- **Vercel Frontend:** Free (100GB bandwidth/month)
- **Render Backend:** Free (750 hours/month)
- **Total:** $0/month for personal use

To upgrade for production:
- Render Starter: $7/month (no sleep, better performance)
- Vercel Pro: $20/month (more bandwidth, better support)
