/* =====================================================================
   CYRO BUS — configuração do Firebase
   Usa o SDK modular (v10) direto via CDN — não precisa de npm/bundler
   para o front-end funcionar.
   ===================================================================== */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Config do projeto "cyro-bus-c527b" no Firebase Console.
// Esse "apiKey" do Firebase Web NÃO é secreto — ele identifica o projeto,
// quem protege seus dados de verdade são as Regras de Segurança do
// Firestore/Auth (veja firestore.rules na raiz do projeto). Ainda assim,
// se algum dia você recriar o projeto, troque os valores abaixo pelos
// novos, disponíveis em: Configurações do projeto → Seus apps → SDK setup.
const firebaseConfig = {
  apiKey: "AIzaSyAp-_vd5IZN9vzJWxsiLaBkrK1lcRtYs_o",
  authDomain: "cyro-bus-c527b.firebaseapp.com",
  projectId: "cyro-bus-c527b",
  storageBucket: "cyro-bus-c527b.firebasestorage.app",
  messagingSenderId: "1040847227258",
  appId: "1:1040847227258:web:e9d4d97d67495ff54daec3"
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
