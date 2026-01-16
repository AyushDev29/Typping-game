# 🚀 Deploy to Vercel

## Quick Deploy (Recommended)

### Method 1: Deploy via Vercel Dashboard (Easiest)

1. **Go to Vercel**: https://vercel.com
2. **Sign in** with GitHub
3. **Click "Add New Project"**
4. **Import** your repository: `AyushDev29/Typping-game`
5. **Configure Project**:
   - **Framework Preset**: Other
   - **Root Directory**: `./` (leave as is)
   - **Build Command**: Leave empty
   - **Output Directory**: `public`
   - **Install Command**: Leave empty
6. **Click "Deploy"**
7. **Done!** Your site will be live at `https://your-project.vercel.app`

### Method 2: Deploy via Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy (from project root)
vercel

# Follow prompts:
# - Set up and deploy? Yes
# - Which scope? Your account
# - Link to existing project? No
# - Project name? typping-game (or your choice)
# - Directory? ./ (press Enter)
# - Override settings? No

# Production deployment
vercel --prod
```

## ⚙️ Vercel Configuration

The `vercel.json` file is already configured:

```json
{
  "version": 2,
  "public": true,
  "builds": [
    {
      "src": "public/**",
      "use": "@vercel/static"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/public/$1"
    }
  ]
}
```

## 🔧 Post-Deployment Setup

### 1. Update Firebase Configuration (IMPORTANT!)

After deployment, you need to add your Vercel domain to Firebase:

1. **Go to Firebase Console**: https://console.firebase.google.com
2. **Select your project**: `blind-typing-1`
3. **Go to Authentication** → **Settings** → **Authorized domains**
4. **Add your Vercel domain**:
   - `your-project.vercel.app`
   - `your-custom-domain.com` (if you have one)
5. **Click "Add domain"**

### 2. Update CORS Settings (if needed)

If you face CORS issues:

1. Go to Firebase Console → Firestore → Rules
2. Ensure rules allow your Vercel domain
3. Rules are already configured in `FIRESTORE_RULES.txt`

### 3. Environment Variables (Optional)

If you want to use environment variables:

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add variables (if needed):
   - `FIREBASE_API_KEY`
   - `FIREBASE_AUTH_DOMAIN`
   - etc.

**Note:** Current setup uses hardcoded config in `public/js/firebase.js` which works fine for public Firebase projects.

## 🌐 Custom Domain

### Add Custom Domain to Vercel

1. Go to Vercel Dashboard → Your Project → Settings → Domains
2. Click "Add Domain"
3. Enter your domain: `yourdomain.com`
4. Follow DNS configuration instructions
5. Add domain to Firebase authorized domains (see above)

### DNS Configuration

Add these records to your domain provider:

**For root domain (yourdomain.com):**
```
Type: A
Name: @
Value: 76.76.21.21
```

**For www subdomain:**
```
Type: CNAME
Name: www
Value: cname.vercel-dns.com
```

## 🔍 Verify Deployment

After deployment, test these pages:

1. **Landing Page**: `https://your-project.vercel.app/`
2. **Login**: `https://your-project.vercel.app/login.html`
3. **Join Room**: `https://your-project.vercel.app/join-room.html`
4. **Admin Dashboard**: `https://your-project.vercel.app/admin/dashboard.html`

## 🐛 Troubleshooting

### Issue: 404 Not Found

**Solution:**
- Check `vercel.json` routes configuration
- Ensure `public` directory exists
- Redeploy: `vercel --prod`

### Issue: Firebase Connection Error

**Solution:**
1. Check Firebase config in `public/js/firebase.js`
2. Verify domain is authorized in Firebase Console
3. Check browser console for specific errors

### Issue: Authentication Not Working

**Solution:**
1. Add Vercel domain to Firebase authorized domains
2. Clear browser cache
3. Check Firestore rules are published

### Issue: Static Files Not Loading

**Solution:**
1. Check file paths are relative (not absolute)
2. Verify files exist in `public` directory
3. Check browser console for 404 errors

## 📊 Monitoring

### Vercel Analytics

1. Go to Vercel Dashboard → Your Project → Analytics
2. View:
   - Page views
   - Unique visitors
   - Performance metrics
   - Error rates

### Firebase Analytics

1. Go to Firebase Console → Analytics
2. View:
   - User engagement
   - Authentication events
   - Database operations

## 🔄 Continuous Deployment

Vercel automatically deploys when you push to GitHub:

```bash
# Make changes
git add .
git commit -m "Your changes"
git push origin main

# Vercel automatically deploys!
```

### Preview Deployments

- Every push to a branch creates a preview deployment
- Preview URL: `https://your-project-git-branch.vercel.app`
- Test before merging to main

## 🎯 Performance Optimization

### Already Configured:

1. ✅ Static file caching (31536000s for CSS/JS)
2. ✅ HTML caching (0s, must-revalidate)
3. ✅ Gzip compression (automatic)
4. ✅ CDN distribution (automatic)

### Additional Optimizations:

1. **Enable Vercel Speed Insights**:
   - Go to Project Settings → Speed Insights
   - Enable it

2. **Optimize Images** (if you add any):
   - Use WebP format
   - Compress before uploading
   - Use Vercel Image Optimization

## 📝 Deployment Checklist

Before deploying:

- [x] Firebase config updated in `firebase.js`
- [x] Firestore rules published
- [x] Firestore indexes created
- [x] Admin email added to `admins` collection
- [x] All files committed to GitHub
- [x] `vercel.json` configured
- [x] `.gitignore` includes sensitive files

After deploying:

- [ ] Add Vercel domain to Firebase authorized domains
- [ ] Test login functionality
- [ ] Test room creation
- [ ] Test typing game flow
- [ ] Test admin dashboard
- [ ] Check browser console for errors

## 🎉 Success!

Your Blind Typing Competition Game is now live on Vercel!

**Share your game:**
- Vercel URL: `https://your-project.vercel.app`
- Custom domain: `https://yourdomain.com` (if configured)

**Next steps:**
1. Share room codes with players
2. Monitor analytics
3. Collect feedback
4. Make improvements

---

**Need help?** Check Vercel documentation: https://vercel.com/docs
