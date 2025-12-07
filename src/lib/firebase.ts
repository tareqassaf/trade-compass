/**
 * Central Firebase configuration for the Trade Compass application.
 * This file initializes Firebase services (Auth, Firestore, Storage) using environment variables.
 */

import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

function assertEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing Firebase env variable: ${name}`);
  }
  return value;
}

const firebaseConfig = {
  apiKey: assertEnv("FIREBASE_API_KEY", import.meta.env.VITE_FIREBASE_API_KEY),
  authDomain: assertEnv("FIREBASE_AUTH_DOMAIN", import.meta.env.VITE_FIREBASE_AUTH_DOMAIN),
  projectId: assertEnv("FIREBASE_PROJECT_ID", import.meta.env.VITE_FIREBASE_PROJECT_ID),
  storageBucket: assertEnv("FIREBASE_STORAGE_BUCKET", import.meta.env.VITE_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: assertEnv("FIREBASE_MESSAGING_SENDER_ID", import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID),
  appId: assertEnv("FIREBASE_APP_ID", import.meta.env.VITE_FIREBASE_APP_ID),
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const firebaseApp = app;
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
