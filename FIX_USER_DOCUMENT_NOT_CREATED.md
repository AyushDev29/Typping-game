# Fix: User Document Not Created in Firestore

## The Problem
User accounts are created in Firebase Authentication but NOT stored in Firestore `users` collection.

## Root Causes & Fixes

### Cause 1: Firestore Rules Not Published ❌
**Most Common Issue!**

**Check:**
1. Go to: https://console.firebase.google.com/project/blind-typing-1/firestore/rules
2. Check if rules match `FIRESTORE_RULES.txt`
3. If different → Copy from `FIRESTORE_RULES.txt` and click "Publish"

**Rules must allow:**
```javascript
match /users/{userId} {
  allow create: if request.auth != null && request.auth.uid == userId;
  allow update: if request.auth != null && request.auth.uid == userId;
}
```

### Cause 2: Browser Console Errors
**Check for errors:**

1. Open browser console (F12)
2. Try to login
3. Look for errors like:
   - "Permission denied"
   - "Missing or insufficient permissions"
   - Any Firestore errors

**If you see "Permission denied":**
- Rules are not published correctly
- Update rules from `FIRESTORE_RULES.txt`

### Cause 3: Code Not Deployed
**Solution:**
```bash
firebase deploy --only hosting
```

## Step-by-Step Fix

### Step 1: Update Firestore Rules (REQUIRED)
1. Open: https://console.firebase.google.com/project/blind-typing-1/firestore/rules
2. Copy ALL content from `FIRESTORE_RULES.txt`
3. Paste into Rules editor
4. Click "Publish"
5. Wait for confirmation

### Step 2: Test Login
1. Go to your app: https://blind-typing-1.web.app/login.html
2. Open browser console (F12)
3. Login with any user
4. Check console for errors
5. Check Firestore → `users` collection

### Step 3: Verify Document Created
1. Go to: https://console.firebase.google.com/project/blind-typing-1/firestore/data
2. Open `users` collection
3. You should see user document with user's UID

## What the Code Does Now

**On Login:**
1. ✅ Authenticates user
2. ✅ Checks if user document exists
3. ✅ If NOT exists → Creates new document (NO merge)
4. ✅ If exists → Updates with merge
5. ✅ Verifies document was created
6. ✅ Throws error if creation fails

**On Registration:**
1. ✅ Creates user in Firebase Auth
2. ✅ Creates user document in Firestore
3. ✅ Stores all user data

## Debug Steps

### Check 1: Are Rules Published?
- Go to Firestore Rules
- Compare with `FIRESTORE_RULES.txt`
- Must match exactly

### Check 2: Test in Browser Console
```javascript
// After login, check if document exists
import { db } from './js/firebase.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const userRef = doc(db, 'users', 'YOUR_USER_ID');
const userDoc = await getDoc(userRef);
console.log('User exists?', userDoc.exists());
console.log('User data:', userDoc.data());
```

### Check 3: Check Browser Console Errors
- Open F12 → Console tab
- Look for red errors
- Copy error message
- Check if it's permission-related

## Quick Test

1. **Update Rules** (if not done)
2. **Clear browser cache** (Ctrl+Shift+R)
3. **Login** with existing user
4. **Check Firestore** → `users` collection
5. **Should see user document!**

## If Still Not Working

**Check these:**
- ✅ Rules published?
- ✅ User authenticated? (check Firebase Auth)
- ✅ Browser console errors?
- ✅ Code deployed? (check if latest version)

**Common Error Messages:**
- "Permission denied" → Rules not published
- "Missing or insufficient permissions" → Rules wrong
- No error but no document → Check console for silent failures

---

**The code is FIXED. Just make sure Firestore rules are published!**

