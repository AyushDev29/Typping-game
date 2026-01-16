# QUICK FIX - User Document Not Created

## The Problem
User exists in Firebase Authentication but NOT in Firestore `users` collection, so:
- Can't set admin role
- System can't find user data

## The Solution (2 Steps)

### Step 1: Add Admin Email to `admins` Collection

1. Go to Firebase Console → Firestore Database
2. Click "+ Start collection"
3. Collection ID: `admins`
4. Document ID: Click "Auto-ID"
5. Add field:
   - Field: `email`
   - Type: `string`
   - Value: `admintypping@gmail.com`
6. Click "Save"

### Step 2: Login Through the App

1. Open your app: `http://localhost:8000/login.html` (or your URL)
2. Login with: `admintypping@gmail.com`
3. **The login function will AUTOMATICALLY:**
   - Check `admins` collection
   - Create user document in `users` collection
   - Set role to `admin`
   - Store all user data

## After Login

Check Firestore → `users` collection:
- You should see document with your user ID
- `role` field should be `"admin"`
- All user data will be there

## That's It!

The login function is now FIXED to:
- ✅ Always create user document if missing
- ✅ Check admins collection FIRST
- ✅ Set correct role automatically
- ✅ Work even if user document doesn't exist

**Just login once and everything will be created automatically!**

