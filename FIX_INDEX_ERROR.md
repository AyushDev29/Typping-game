# Fix Firestore Index Error

## Error Message
```
The query requires an index. You can create it here: [link]
```

## Quick Fix

**Click the link in the error message** - Firebase will automatically create the index for you!

Or manually:

1. Go to Firebase Console → Firestore Database → Indexes
2. Click "Create Index"
3. Collection: `results`
4. Fields to index:
   - `roomId` (Ascending)
   - `round` (Ascending)  
   - `finalScore` (Descending)
5. Click "Create"

**Wait 2-5 minutes** for index to build, then refresh your app.

## Index Required For:
- Leaderboard queries (sorting by finalScore)
- Round results display

