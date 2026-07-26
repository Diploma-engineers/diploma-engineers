import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";

import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

import {
  getDatabase,
  ref,
  push,
  set,
  onValue,
  remove
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";

const firebaseConfig = {

  apiKey: "AIzaSyCcFZaHR5392I-zPgghzyTSHD53FRt4YKI",

  authDomain: "myadmin-1b75f.firebaseapp.com",

  databaseURL: "https://myadmin-1b75f-default-rtdb.asia-southeast1.firebasedatabase.app",

  projectId: "myadmin-1b75f",

  storageBucket: "myadmin-1b75f.firebasestorage.app",

  messagingSenderId: "1018557109448",

  appId: "1:1018557109448:web:a0990e81d47ac64e6801fd"

};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

export const db = getDatabase(app);

export {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  ref,
  push,
  set,
  onValue,
  remove
};
