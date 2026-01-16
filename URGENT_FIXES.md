# URGENT FIXES - Do These Now

## Error 1: getRoomParticipants not defined
**Status:** ✅ Fixed in code (import added)
**Action:** Clear browser cache or hard refresh
- Press `Ctrl + Shift + R` (Windows) or `Cmd + Shift + R` (Mac)
- Or open in incognito/private window

## Error 2: Missing Firestore Index
**Status:** ❌ NEEDS ACTION
**Action:** CREATE INDEX NOW

### Quick Method (Easiest):
1. **Click the link in the error message** - it will auto-create the index
2. Wait 2-5 minutes for index to build
3. Refresh page

### Manual Method:
1. Go to: https://console.firebase.google.com/project/blind-typing-1/firestore/indexes
2. Click "Create Index"
3. Collection: `results`
4. Fields:
   - `roomId` - Ascending
   - `round` - Ascending
   - `finalScore` - Descending
5. Click "Create"
6. Wait 2-5 minutes

**This index is REQUIRED for:**
- Viewing leaderboard
- Ending rounds
- Getting results

## Error 3: Missing or insufficient permissions
**Status:** ✅ Fixed in FIRESTORE_RULES.txt
**Action:** UPDATE FIRESTORE RULES NOW

1. Go to: https://console.firebase.google.com/project/blind-typing-1/firestore/rules
2. Copy ALL rules from `FIRESTORE_RULES.txt`
3. Paste into Rules editor
4. Click "Publish"

**Current rules allow:**
- ✅ Room updates (for starting/ending rounds)
- ✅ Participant updates
- ✅ Result creation

## Priority Order:

1. **FIRST:** Update Firestore Rules (2 minutes)
2. **SECOND:** Create Index (click link in error) (2-5 minutes wait)
3. **THIRD:** Hard refresh browser (Ctrl+Shift+R)

## After Fixes:

1. Refresh the page
2. Try starting Round 1 again
3. Should work now!

---

**The code is fixed. You just need to:**
1. Update Firestore rules
2. Create the index
3. Clear browser cache

