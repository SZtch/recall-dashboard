# 🚀 Deployment Guide - Recall Dashboard

## Deploy to Vercel (Recommended)

### Prerequisites
- GitHub account
- Vercel account (free): https://vercel.com/signup

### Method 1: Vercel Dashboard (Easiest)

1. **Push your code to GitHub** (already done ✓)

2. **Go to Vercel Dashboard**
   - Visit: https://vercel.com/new
   - Click "Import Git Repository"
   - Select `SZtch/recall-dashboard`

3. **Configure Project**
   ```
   Framework Preset: Vite
   Build Command: npm run build
   Output Directory: dist
   Root Directory: ./
   ```

4. **Deploy**
   - Click "Deploy"
   - Wait ~2-3 minutes
   - Your site will be live at: `https://recall-dashboard-xxxxx.vercel.app`

5. **Custom Domain (Optional)**
   - Go to Project Settings → Domains
   - Add your custom domain (e.g., `recall.yourdomain.com`)

### Method 2: Vercel CLI

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**
   ```bash
   vercel login
   ```

3. **Deploy**
   ```bash
   vercel
   ```
   
   Follow the prompts:
   - Set up and deploy? **Y**
   - Which scope? (select your account)
   - Link to existing project? **N**
   - Project name? **recall-dashboard**
   - In which directory? **./**
   - Want to override settings? **N**

4. **Deploy to Production**
   ```bash
   vercel --prod
   ```

### Method 3: Auto-Deploy on Git Push

Once connected to Vercel:
- Every push to `main` branch = Production deploy
- Every push to other branches = Preview deploy
- Pull requests get automatic preview URLs

---

## Deploy to Netlify (Alternative)

### Via Netlify Dashboard

1. **Go to Netlify**
   - Visit: https://app.netlify.com/start
   - Login with GitHub

2. **Import Repository**
   - Click "Add new site" → "Import an existing project"
   - Choose GitHub → Select `SZtch/recall-dashboard`

3. **Build Settings**
   ```
   Build command: npm run build
   Publish directory: dist
   ```

4. **Deploy**
   - Click "Deploy site"
   - Site will be live at: `https://recall-dashboard-xxxxx.netlify.app`

### Via Netlify CLI

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Build project
npm run build

# Deploy
netlify deploy --prod --dir=dist
```

---

## Deploy to GitHub Pages

1. **Install gh-pages**
   ```bash
   npm install --save-dev gh-pages
   ```

2. **Update vite.config.js**
   ```js
   export default defineConfig({
     base: '/recall-dashboard/', // repo name
     // ... rest of config
   })
   ```

3. **Add deploy scripts to package.json**
   ```json
   {
     "scripts": {
       "predeploy": "npm run build",
       "deploy": "gh-pages -d dist"
     }
   }
   ```

4. **Deploy**
   ```bash
   npm run deploy
   ```

5. **Enable GitHub Pages**
   - Go to repo Settings → Pages
   - Source: `gh-pages` branch
   - Site will be live at: `https://sztch.github.io/recall-dashboard`

---

## Environment Variables

If you need environment variables (API keys, etc.):

### Vercel
1. Go to Project Settings → Environment Variables
2. Add variables:
   ```
   VITE_RECALL_API_URL=https://api.recall.com
   VITE_APP_ENV=production
   ```

### Netlify
1. Go to Site Settings → Build & Deploy → Environment
2. Add variables (same as above)

### Local .env.production
```env
VITE_RECALL_API_URL=https://api.recall.com
VITE_APP_ENV=production
```

---

## Post-Deployment Checklist

✅ Test all functionality on production URL
✅ Verify API connections work
✅ Test on mobile devices
✅ Check console for errors
✅ Set up custom domain (optional)
✅ Enable HTTPS (automatic on Vercel/Netlify)
✅ Add site to Google Analytics (optional)

---

## Continuous Deployment

Once connected to Vercel or Netlify:
- Push to `main` → Auto-deploy to production
- Create PR → Get preview URL
- Merge PR → Auto-deploy to production

Example workflow:
```bash
# Make changes
git add .
git commit -m "Add new feature"
git push origin main

# Vercel/Netlify automatically deploys!
```

---

## Troubleshooting

### Build fails on Vercel/Netlify
- Check build logs in dashboard
- Ensure `package.json` has all dependencies
- Verify Node version (should be 18.x or 20.x)

### Blank page after deployment
- Check browser console for errors
- Verify `base` path in `vite.config.js`
- Check if API endpoints are accessible

### 404 on page refresh
- For SPAs, add redirect rules:
  
  **Vercel** - Create `vercel.json`:
  ```json
  {
    "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
  }
  ```
  
  **Netlify** - Create `public/_redirects`:
  ```
  /*    /index.html   200
  ```

---

## Recommended: Vercel

Why Vercel?
✅ Automatic HTTPS
✅ Global CDN
✅ Zero configuration
✅ Auto-deploy on push
✅ Preview URLs for PRs
✅ Excellent performance
✅ Free tier is generous

Your dashboard will load **fast** worldwide! 🚀
