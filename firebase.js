import { initializeApp } from "firebase/app";
import { getDatabase, ref, get, child } from "@firebase/database";

const firebaseConfig = {
    apiKey: "API_KEY",
    authDomain: "zippy-starlight-379008.firebaseapp.com",
    databaseURL: "https://zippy-starlight-379008-default-rtdb.firebaseio.com",
    projectId: "zippy-starlight-379008",
    storageBucket: "zippy-starlight-379008.appspot.com",
    messagingSenderId: "582370359757",
    appId: "1:582370359757:web:b042070a096a0f84aeec84"
};

const app = initializeApp(firebaseConfig);
const dbRef = ref(getDatabase(app));

export {
    app, dbRef, get, child
}
