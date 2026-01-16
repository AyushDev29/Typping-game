# Role Management Guide

## How to Change User Roles

You can change user roles in two ways:

### Method 1: Through Admin Panel (Recommended) ✅

1. Login as admin
2. Go to Admin Dashboard
3. Click "Manage Users"
4. Find the user you want to change
5. Select new role from dropdown (Admin or Participant)
6. Confirm the change
7. **User must logout and login again for changes to take effect**

### Method 2: Directly in Firebase Console

1. Go to Firebase Console → Firestore Database
2. Open `users` collection
3. Find the user document (by user ID)
4. Click on the document
5. Edit the `role` field:
   - Change value to `"admin"` to make user admin
   - Change value to `"participant"` to make user participant
6. Click "Update"
7. **User must logout and login again for changes to take effect**

## How Role Detection Works

The system checks roles in this priority order:

1. **First:** Checks `users` collection → `role` field
2. **Fallback:** If role not set, checks `admins` collection → email match

**This means:**
- If you set `role: "admin"` in `users` collection, user becomes admin
- If you set `role: "participant"` in `users` collection, user becomes participant
- The `admins` collection is only checked if role is not set in `users` collection

## Role Field Values

- `"admin"` - Full admin access
- `"participant"` - Regular user (can join rooms, compete)

## Important Notes

⚠️ **Changes take effect on next login:**
- User must logout and login again
- Role is checked during login process
- Session storage is updated with new role

⚠️ **Admin Access:**
- Only admins can access admin panel
- Only admins can change user roles
- Role changes are logged in Firestore

⚠️ **Security:**
- Firestore rules prevent non-admins from changing roles
- Users cannot change their own role
- Only admins can update the `role` field

## Example: Making a User Admin

### Via Admin Panel:
1. Login as admin
2. Dashboard → Manage Users
3. Find user email
4. Change dropdown to "Admin"
5. Confirm
6. User logs out and back in → Now admin!

### Via Firebase Console:
1. Firestore → `users` collection
2. Find user document
3. Edit `role` field → Set to `"admin"`
4. Update
5. User logs out and back in → Now admin!

## Example: Removing Admin Access

### Via Admin Panel:
1. Login as admin
2. Dashboard → Manage Users
3. Find admin user
4. Change dropdown to "Participant"
5. Confirm
6. User logs out and back in → Now participant!

### Via Firebase Console:
1. Firestore → `users` collection
2. Find user document
3. Edit `role` field → Set to `"participant"`
4. Update
5. User logs out and back in → Now participant!

## Verification

After changing a role:
1. User logs out
2. User logs back in
3. Check redirect:
   - Admin → Goes to Admin Dashboard
   - Participant → Goes to Join Room page

## Troubleshooting

### Role change not working?
- ✅ Make sure user logged out and back in
- ✅ Check Firestore rules are published
- ✅ Verify `role` field is exactly `"admin"` or `"participant"` (case-sensitive)
- ✅ Check browser console for errors

### User still has old role?
- ✅ Clear browser cache
- ✅ Clear sessionStorage
- ✅ Logout completely
- ✅ Login again

### Cannot access admin panel?
- ✅ Verify role is set to `"admin"` in Firestore
- ✅ Check email matches exactly
- ✅ Try logging out and back in

---

**Role management is now fully functional!** 🎉

