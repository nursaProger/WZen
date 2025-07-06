import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyAiNlBD3WUShH61qQL0awq8TSeogc64-zc",
  authDomain: "wzen-app.firebaseapp.com",
  databaseURL: "https://wzen-app-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "wzen-app",
  storageBucket: "wzen-app.firebasestorage.app",
  messagingSenderId: "358641570736",
  appId: "1:358641570736:web:6afeda1fd008f16e393c75",
  measurementId: "G-5YPJSQRL5S"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Realtime Database
export const database = getDatabase(app);

export default app; 