// Configuración Firebase - Credenciales Reales
const firebaseConfig = {
    apiKey: "AIzaSyAGwSStDLh-OIZ5q6pPm-0qnzsudsdjhJw",
    authDomain: "taller-revision-por-pares.firebaseapp.com",
    projectId: "taller-revision-por-pares",
    storageBucket: "taller-revision-por-pares.firebasestorage.app",
    messagingSenderId: "1002962434375",
    appId: "1:1002962434375:web:894eb95a27a5710b72b462",
    measurementId: "G-LLMFNH7884"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

console.log('🔥 Firebase inicializado con proyecto: taller-revision-por-pares');
