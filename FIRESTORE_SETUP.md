# Firestore Security Rules Setup

## Deploy Firestore Security Rules

To fix the "Missing or insufficient permissions" error, you need to deploy the Firestore security rules.

### Option 1: Using Firebase CLI (Recommended)

1. **Install Firebase CLI** (if not already installed):
   ```bash
   npm install -g firebase-tools
   ```

2. **Login to Firebase**:
   ```bash
   firebase login
   ```

3. **Initialize Firebase in your project** (if not already done):
   ```bash
   firebase init firestore
   ```
   - Select your Firebase project: `trae-compass`
   - Use the existing `firestore.rules` file
   - Use the existing `firestore.indexes.json` file

4. **Deploy the rules**:
   ```bash
   firebase deploy --only firestore:rules
   ```

### Option 2: Using Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `trae-compass`
3. Navigate to **Firestore Database** → **Rules** tab
4. Copy the contents of `firestore.rules` and paste into the rules editor
5. Click **Publish**

## Deploy Firestore Indexes

If you get an index error, deploy the indexes:

```bash
firebase deploy --only firestore:indexes
```

Or use the Firebase Console:
1. Go to **Firestore Database** → **Indexes** tab
2. The console will show a link to create the required index when you run a query that needs it

## Testing

After deploying the rules, test by:
1. Signing in to your app
2. Accessing the Dashboard (which reads from `users/{userId}/dailyStats`)

The rules allow authenticated users to:
- Read and write their own user document
- Read and write their own trades
- Read and write their own daily stats
- Read and write their own playbooks
- Read and write their own journal entries

## Security Rules Overview

The rules ensure:
- Only authenticated users can access data
- Users can only access their own data (based on `userId` matching `request.auth.uid`)
- All subcollections under `users/{userId}` are protected

