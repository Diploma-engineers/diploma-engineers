// ===============================
// Diploma Engineers
// firebase.js
// ===============================

// Firebase App
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";

// Firebase Authentication
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

// Firebase Realtime Database
import {
  getDatabase,
  ref,
  push,
  set,
  update,
  remove,
  get,
  child,
  onValue
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-database.js";


// ===============================
// Firebase Configuration
// ===============================

const firebaseConfig = {

  apiKey: "AIzaSyBib3rW6lf29qjgeKmSNS5jsOrO_uhzi7c",

  authDomain: "electrical-f83b2.firebaseapp.com",

  databaseURL: "hhttps://electrical-f83b2-default-rtdb.firebaseio.com/",

  projectId: "electrical-f83b2",

  storageBucket: "electrical-f83b2.firebasestorage.app",

  messagingSenderId: "1082065159119",

  appId: "1:1082065159119:web:d91f28cea1c3de0a77c8ba"

};


// ===============================
// Initialize Firebase
// ===============================

const app = initializeApp(firebaseConfig);


// ===============================
// Authentication
// ===============================

const auth = getAuth(app);


// ===============================
// Realtime Database
// ===============================

const db = getDatabase(app);


// ===============================
// Export Everything
// ===============================

export {

  app,

  auth,

  db,

  signInWithEmailAndPassword,

  signOut,

  onAuthStateChanged,

  ref,

  push,

  set,

  update,

  remove,

  get,

  child,

  onValue

};
