# Firebase Hosting Deployment Guide

## 🚀 Quick Deployment Steps

### Prerequisites
- Node.js installed (for Firebase CLI)
- Firebase account
- Project already created: `blind-typing-1`

### Step 1: Install Firebase CLI

```bash
npm install -g firebase-tools
```

### Step 2: Login to Firebase

```bash
firebase login
```

This will open your browser to authenticate.

### Step 3: Initialize Firebase (if needed)

If you haven't initialized Firebase yet:

```bash
firebase init hosting
```

**When prompted:**
- ✅ Use an existing project: `blind-typing-1`
- ✅ What do you want to use as your public directory? `public`
- ✅ Configure as a single-page app? `No` (we have multiple HTML pages)
- ✅ Set up automatic builds and deploys with GitHub? `No` (optional)

**Note:** The configuration files (`firebase.json` and `.firebaserc`) are already created for you!

### Step 4: Deploy to Firebase Hosting

```bash
firebase deploy --only hosting
```

### Step 5: Access Your App

After deployment, you'll get a URL like:
```
https://blind-typing-1.web.app
https://blind-typing-1.firebaseapp.com
```

## 📝 Deployment Commands

### Deploy Everything
```bash
firebase deploy
```

### Deploy Only Hosting
```bash
firebase deploy --only hosting
```

### Deploy Only Firestore Rules
```bash
firebase deploy --only firestore:rules
```

### Preview Before Deploying
```bash
firebase serve
```
Then open: `http://localhost:5000`

## 🔄 Update Deployment

After making changes:

1. Test locally:
   ```bash
   cd public
   python -m http.server 8000
   ```

2. Deploy:
   ```bash
   firebase deploy --only hosting
   ```

## ⚙️ Configuration Files

### `firebase.json`
- Sets `public` as the hosting directory
- Configures caching for static assets
- Sets up rewrites for routing

### `.firebaserc`
- Links to your Firebase project: `blind-typing-1`

## 🐛 Troubleshooting

### "Firebase CLI not found"
```bash
npm install -g firebase-tools
```

### "Permission denied"
- Make sure you're logged in: `firebase login`
- Check you have access to the project

### "Project not found"
- Verify project ID in `.firebaserc` matches your Firebase project
- Check Firebase Console for correct project ID

### "Deployment failed"
- Check Firebase Console for error details
- Ensure Firestore rules are published
- Verify all files are in the `public` directory

## 📊 View Deployment History

```bash
firebase hosting:channel:list
```

## 🔗 Custom Domain (Optional)

1. Go to Firebase Console → Hosting
2. Click "Add custom domain"
3. Follow the setup instructions

## ✅ Pre-Deployment Checklist

- [ ] Firestore security rules published
- [ ] Admin user created in Firestore
- [ ] Authentication enabled
- [ ] Tested locally
- [ ] All files in `public` directory
- [ ] Firebase CLI installed and logged in

---

**Ready to deploy?** Run:
```bash
firebase deploy --only hosting
```

