import { initializeApp } from "firebase/app";

const firebaseConfig = {
  apiKey: "API_KEY_KAMU",
  authDomain: "PROJECT_ID.firebaseapp.com",
  projectId: "PROJECT_ID",
  storageBucket: "PROJECT_ID.appspot.com",
  messagingSenderId: "ID_KAMU",
  appId: "APP_ID_KAMU"
};

const app = initializeApp(firebaseConfig);

console.log("Firebase berhasil diinisialisasi");
