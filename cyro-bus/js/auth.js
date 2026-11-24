/* =====================================================================
   CYRO BUS — autenticação real (Firebase Auth + Firestore)
   Módulo ES — importa o SDK do Firebase e conversa com as funções de
   UI expostas globalmente por js/app.js (enterAppUI, exitAppUI,
   getFavoritesArray, setFavoritesArray, showErr, clearErr...).
   ===================================================================== */
import { auth, db } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  sendPasswordResetEmail,
  deleteUser
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc, getDoc, setDoc, deleteDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Política de senha para contas novas e trocas de senha (contas antigas de 6 caracteres ainda entram)
function passwordProblem(p) {
  if (p.length < 8) return 'A senha deve ter pelo menos 8 caracteres.';
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return 'Use letras e números na senha.';
  return '';
}

const DEFAULT_FAVORITES = ["500", "510", "504"];

/* ---------- helpers de Firestore: documento users/{uid} ---------- */
async function loadUserDoc(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}
async function createUserDoc(uid, name, email) {
  const ref = doc(db, "users", uid);
  await setDoc(ref, {
    name, email,
    favorites: DEFAULT_FAVORITES,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}
async function saveFavoritesToFirestore(favArray) {
  if (!auth.currentUser) return; // visitante não persiste
  const ref = doc(db, "users", auth.currentUser.uid);
  await setDoc(ref, { favorites: favArray, updatedAt: serverTimestamp() }, { merge: true });
}
async function saveNameToFirestore(name) {
  if (!auth.currentUser) return;
  await updateProfile(auth.currentUser, { displayName: name });
  const ref = doc(db, "users", auth.currentUser.uid);
  await setDoc(ref, { name, updatedAt: serverTimestamp() }, { merge: true });
}

/* ---------- formulários ---------- */
async function handleLogin(e) {
  e.preventDefault();
  clearErr('login-error');
  const email = document.getElementById('login-email').value.trim();
  const pass = document.getElementById('login-pass').value;
  if (!/^\S+@\S+\.\S+$/.test(email)) { showErr('login-error', 'Digite um e-mail válido.'); return false; }
  if (pass.length < 6) { showErr('login-error', 'A senha precisa ter pelo menos 6 caracteres.'); return false; }

  setAuthLoading('form-login', true);
  try {
    await signInWithEmailAndPassword(auth, email, pass);
    // o onAuthStateChanged abaixo cuida de mostrar o app
  } catch (err) {
    showErr('login-error', mapFirebaseError(err));
  } finally {
    setAuthLoading('form-login', false);
  }
  return false;
}

async function handleSignup(e) {
  e.preventDefault();
  clearErr('signup-error');
  const name = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const pass = document.getElementById('signup-pass').value;
  if (name.length < 2) { showErr('signup-error', 'Digite seu nome.'); return false; }
  if (!/^\S+@\S+\.\S+$/.test(email)) { showErr('signup-error', 'Digite um e-mail válido.'); return false; }
  const pw = passwordProblem(pass);
  if (pw) { showErr('signup-error', pw); return false; }
  if (!document.getElementById('signup-terms').checked) { showErr('signup-error', 'Para criar a conta, aceite os Termos de Uso e a Política de Privacidade.'); return false; }

  setAuthLoading('form-signup', true);
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(cred.user, { displayName: name });
    await createUserDoc(cred.user.uid, name, email);
    // o onAuthStateChanged abaixo cuida de mostrar o app
  } catch (err) {
    showErr('signup-error', mapFirebaseError(err));
  } finally {
    setAuthLoading('form-signup', false);
  }
  return false;
}

function enterGuest() {
  // Visitante não usa Firebase — dados ficam só na memória da aba atual.
  enterAppUI('Visitante', 'visitante@cyrobus.app', true);
  setFavoritesArray(DEFAULT_FAVORITES);
}

async function logout() {
  if (auth.currentUser) {
    try { await signOut(auth); } catch (err) { console.error(err); }
  }
  exitAppUI();
}

function mapFirebaseError(err, ctx) {
  const code = err && err.code || '';
  if (ctx === 'password') { // reautenticação para trocar senha / excluir conta
    if (code.includes('invalid-credential') || code.includes('wrong-password')) return 'Senha atual incorreta.';
    if (code.includes('too-many-requests')) return 'Muitas tentativas. Aguarde alguns minutos e tente de novo.';
    if (code.includes('requires-recent-login')) return 'Por segurança, saia e entre novamente antes de repetir esta ação.';
  }
  if (code.includes('too-many-requests')) return 'Muitas tentativas. Aguarde alguns minutos e tente de novo.';
  console.error('Erro de autenticação/Firestore:', code, err); // aparece no F12 → Console
  if (code.includes('user-not-found') || code.includes('invalid-credential') || code.includes('wrong-password')) return 'E-mail ou senha incorretos.';
  if (code.includes('email-already-in-use')) return 'Esse e-mail já tem uma conta. Tente entrar.';
  if (code.includes('invalid-email')) return 'Digite um e-mail válido.';
  if (code.includes('weak-password')) return 'A senha é muito fraca — use pelo menos 6 caracteres.';
  if (code.includes('network-request-failed')) return 'Sem conexão com o Firebase. Verifique sua internet.';
  if (code.includes('operation-not-allowed')) return 'Login por e-mail/senha ainda não foi ativado no Firebase Console (Authentication → Sign-in method).';
  if (code.includes('unauthorized-domain')) return 'Este endereço não está autorizado no Firebase (Authentication → Settings → Authorized domains).';
  if (code === 'permission-denied' || code.includes('permission-denied')) return 'Sem permissão para salvar no Firestore — confira se as regras de firestore.rules foram publicadas.';
  if (code.includes('not-found') || code.includes('unavailable')) return 'O banco de dados (Firestore) ainda não foi criado no Firebase Console.';
  return `Não foi possível completar a operação${code ? ' (' + code + ')' : ''}. Tente novamente.`;
}

/* ---------- segurança da conta ---------- */
async function reauth(currentPassword) {
  const u = auth.currentUser;
  await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, currentPassword));
  return u;
}

async function changePassword() {
  clearErr('pw-error'); hideOk('pw-ok');
  const cur = document.getElementById('pw-current').value;
  const nw = document.getElementById('pw-new').value;
  const conf = document.getElementById('pw-confirm').value;
  if (!auth.currentUser) { showErr('pw-error', 'Entre na sua conta para alterar a senha.'); return; }
  if (!cur) { showErr('pw-error', 'Digite sua senha atual.'); return; }
  const problem = passwordProblem(nw);
  if (problem) { showErr('pw-error', problem); return; }
  if (nw === cur) { showErr('pw-error', 'A nova senha deve ser diferente da atual.'); return; }
  if (nw !== conf) { showErr('pw-error', 'A confirmação não confere com a nova senha.'); return; }
  const btn = document.getElementById('btn-pw'); btn.disabled = true;
  try {
    const u = await reauth(cur);
    await updatePassword(u, nw);
    ['pw-current', 'pw-new', 'pw-confirm'].forEach(i => { document.getElementById(i).value = ''; });
    showOk('pw-ok', 'Senha alterada com sucesso. Use a nova senha no próximo login.');
  } catch (err) {
    showErr('pw-error', mapFirebaseError(err, 'password'));
  } finally { btn.disabled = false; }
}

// "Esqueci minha senha": o Firebase envia o link de redefinição por e-mail
async function sendReset(email, errId) {
  if (!/^\S+@\S+\.\S+$/.test(email)) { showErr(errId, 'Digite um e-mail válido para receber o link.'); return false; }
  try {
    await sendPasswordResetEmail(auth, email);
    // mensagem neutra: não revela se o e-mail tem conta
    showToast('Se existir uma conta com esse e-mail, enviamos um link para redefinir a senha. Veja também o spam.');
    return true;
  } catch (err) { showErr(errId, mapFirebaseError(err)); return false; }
}
async function handleForgot(e) {
  if (e) e.preventDefault();
  clearErr('login-error');
  await sendReset(document.getElementById('login-email').value.trim(), 'login-error');
  return false;
}
async function sendResetFromProfile() {
  clearErr('pw-error'); hideOk('pw-ok');
  if (auth.currentUser) await sendReset(auth.currentUser.email, 'pw-error');
}

// LGPD — eliminação: apaga o documento no Firestore e o usuário no Authentication
async function deleteAccount() {
  clearErr('del-error');
  const pass = document.getElementById('del-pass').value;
  if (!auth.currentUser) { showErr('del-error', 'Entre na sua conta para excluí-la.'); return; }
  if (!pass) { showErr('del-error', 'Digite sua senha para confirmar.'); return; }
  if (!window.confirm('Excluir sua conta definitivamente? Seu nome, e-mail e favoritos serão apagados e isso não pode ser desfeito.')) return;
  const btn = document.getElementById('btn-del'); btn.disabled = true;
  try {
    const u = await reauth(pass);
    await deleteDoc(doc(db, 'users', u.uid));
    await deleteUser(u);
    exitAppUI();
    showToast('Conta excluída. Seus dados foram apagados.');
  } catch (err) {
    showErr('del-error', mapFirebaseError(err, 'password'));
  } finally { btn.disabled = false; }
}

/* ---------- sessão: mantém login entre recarregamentos da página ---------- */
onAuthStateChanged(auth, async (user) => {
  if (user) {
    let data = await loadUserDoc(user.uid);
    if (!data) { // conta criada antes de existir o documento no Firestore
      data = { name: user.displayName || user.email.split('@')[0], favorites: DEFAULT_FAVORITES };
      await createUserDoc(user.uid, data.name, user.email);
    }
    enterAppUI(data.name || user.displayName || 'Usuário', user.email, false);
    setFavoritesArray(data.favorites || DEFAULT_FAVORITES);
  }
  // se user for null, deixamos a tela de login como está (não força exitAppUI
  // aqui para não sobrescrever o modo "Visitante", que não passa pelo Firebase)
});

/* ---------- conecta com os cliques do HTML (onclick="...") ---------- */
window.handleLogin = handleLogin;
window.handleSignup = handleSignup;
window.enterGuest = enterGuest;
window.logout = logout;
window.onFavoritesChanged = saveFavoritesToFirestore;
window.onProfileSaved = saveNameToFirestore;
window.changePassword = changePassword;
window.handleForgot = handleForgot;
window.sendResetFromProfile = sendResetFromProfile;
window.deleteAccount = deleteAccount;
window.mapAuthError = mapFirebaseError;
