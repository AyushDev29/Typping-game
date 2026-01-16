# Fix: Round Not Ending - Missing Firestore Index

## The Problem
**Error:** `The query requires an index`
**Affects:** 
- ❌ Ending rounds
- ❌ Viewing leaderboard
- ❌ Getting results

## 🚀 QUICK FIX (Easiest - 2 minutes)

### Method 1: Click the Link in Error (RECOMMENDED)

1. **Open browser console** (Press `F12`)
2. **Find the error message** with the long link
3. **Click the link** in the error message
   - It looks like: `https://console.firebase.google.com/v1/r/project/blind-typing-1/firestore/indexes?create_composite=...`
4. **Firebase Console will open** with the index pre-configured
5. **Click "Create Index"**
6. **Wait 2-5 minutes** for index to build
7. **Refresh your admin page**
8. **Try ending the round again** ✅

### Method 2: Manual Creation

1. Go to: https://console.firebase.google.com/project/blind-typing-1/firestore/indexes
2. Click **"Create Index"** button
3. Fill in:
   - **Collection ID:** `results`
   - **Fields to index:**
     - Field: `roomId` → Order: **Ascending** → Add field
     - Field: `round` → Order: **Ascending** → Add field
     - Field: `finalScore` → Order: **Descending** → Add field
4. Click **"Create"**
5. **Wait 2-5 minutes** for index to build
6. **Refresh your admin page**
7. **Try ending the round again** ✅

## 📋 What This Index Does

This composite index allows Firestore to efficiently query:
- Results filtered by `roomId` AND `round`
- Sorted by `finalScore` (descending)

**Required for:**
- ✅ Ending rounds (finding top performers)
- ✅ Displaying leaderboard
- ✅ Getting round results

## ⏱️ Timeline

1. **Create index:** 30 seconds
2. **Wait for build:** 2-5 minutes
3. **Test:** 30 seconds

**Total time: ~5-6 minutes**

## ✅ Verification

After index is built:

1. Go to: https://console.firebase.google.com/project/blind-typing-1/firestore/indexes
2. Look for index on `results` collection
3. Status should be: **"Enabled"** ✅
4. Try ending round in your app
5. Should work now! ✅

## 🔍 Why This Happens

Firestore requires composite indexes when you:
- Filter by multiple fields (`roomId` AND `round`)
- AND sort by another field (`finalScore`)

This is a **Firestore requirement**, not a code bug!

---

**Quick Action:** Click the link in the error message → Create Index → Wait 5 minutes → Done! ✅

