import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
    apiKey: "AIzaSyD8x3vcXpQOn2RDug-9ORN_zdMJ8PhCFps",
    authDomain: "shopping-list-2f3cf.firebaseapp.com",
    projectId: "shopping-list-2f3cf",
    storageBucket: "shopping-list-2f3cf.firebasestorage.app",
    messagingSenderId: "457882555180",
    appId: "1:457882555180:web:8b347cad288fe5b83cd289"
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
