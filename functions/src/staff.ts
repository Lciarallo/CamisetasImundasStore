import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import {
  ROLE_PERMISSIONS,
  type AdminUserDoc,
  type Permission,
  type Role,
} from './domain.js';
import { applyStaffAccess, requirePermission } from './auth.js';

const REGION = 'southamerica-east1';
const ROLES: Role[] = ['mestre', 'necromante', 'acolito', 'servo'];

/**
 * Cria ou atualiza um integrante da equipe.
 *
 * A conta vive no Firebase Auth (senha com hash, gerenciada pelo Google) e o
 * perfil no Firestore. Cargo e privilégios são gravados nos dois lugares pela
 * `applyStaffAccess`, para documento e token nunca divergirem.
 */
export const saveStaff = onCall({ region: REGION }, async (request) => {
  const { uid: actorUid } = requirePermission(request, 'users.edit');

  const { uid, name, email, password, role, permissions, active } = (request.data ??
    {}) as {
    uid?: string;
    name?: string;
    email?: string;
    password?: string;
    role?: Role;
    permissions?: Permission[];
    active?: boolean;
  };

  if (typeof name !== 'string' || name.trim().length < 2) {
    throw new HttpsError('invalid-argument', 'Nome inválido.');
  }
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    throw new HttpsError('invalid-argument', 'E-mail inválido.');
  }
  if (!ROLES.includes(role as Role)) {
    throw new HttpsError('invalid-argument', 'Cargo inválido.');
  }

  const db = getFirestore();
  const auth = getAuth();

  // Só existe um Mestre. Promover um segundo criaria dois donos capazes de se
  // rebaixarem mutuamente, e nenhum deles removível.
  if (role === 'mestre') {
    const masters = await db
      .collection('adminUsers')
      .where('role', '==', 'mestre')
      .get();
    const someoneElseIsMaster = masters.docs.some((doc) => doc.id !== uid);
    if (someoneElseIsMaster) {
      throw new HttpsError('failed-precondition', 'Já existe um Mestre.');
    }
  }

  let targetUid = uid;

  if (targetUid) {
    const existing = await db.collection('adminUsers').doc(targetUid).get();
    if (!existing.exists) throw new HttpsError('not-found', 'Usuário não encontrado.');

    const current = existing.data() as AdminUserDoc;

    // Rebaixar o Mestre trancaria todo mundo para fora da administração.
    if (current.role === 'mestre' && role !== 'mestre') {
      throw new HttpsError('failed-precondition', 'O Mestre não pode ser rebaixado.');
    }
    // Desativar a própria conta é o mesmo erro, só que mais rápido.
    if (targetUid === actorUid && active === false) {
      throw new HttpsError('failed-precondition', 'Você não pode desativar a própria conta.');
    }

    await auth.updateUser(targetUid, {
      email,
      displayName: name.trim(),
      disabled: active === false,
      ...(password && password.length >= 6 ? { password } : {}),
    });
  } else {
    if (typeof password !== 'string' || password.length < 6) {
      throw new HttpsError('invalid-argument', 'A senha precisa de ao menos 6 caracteres.');
    }
    const created = await auth.createUser({
      email,
      password,
      displayName: name.trim(),
      disabled: active === false,
    });
    targetUid = created.uid;
  }

  const effective = await applyStaffAccess(
    targetUid!,
    role as Role,
    Array.isArray(permissions) ? permissions : ROLE_PERMISSIONS[role as Role],
    active !== false,
  );

  const doc: AdminUserDoc = {
    name: name.trim(),
    email,
    role: role as Role,
    permissions: effective,
    active: role === 'mestre' ? true : active !== false,
    createdAt: new Date().toISOString(),
  };

  await db
    .collection('adminUsers')
    .doc(targetUid!)
    .set(doc, { merge: true });

  return { uid: targetUid, ...doc };
});

export const deleteStaff = onCall({ region: REGION }, async (request) => {
  const { uid: actorUid } = requirePermission(request, 'users.edit');
  const { uid } = (request.data ?? {}) as { uid?: string };

  if (!uid || typeof uid !== 'string') {
    throw new HttpsError('invalid-argument', 'Usuário não informado.');
  }
  if (uid === actorUid) {
    throw new HttpsError('failed-precondition', 'Você não pode remover a própria conta.');
  }

  const db = getFirestore();
  const snap = await db.collection('adminUsers').doc(uid).get();
  if (!snap.exists) throw new HttpsError('not-found', 'Usuário não encontrado.');

  if ((snap.data() as AdminUserDoc).role === 'mestre') {
    throw new HttpsError('failed-precondition', 'O Mestre não pode ser removido.');
  }

  await getAuth().deleteUser(uid);
  await db.collection('adminUsers').doc(uid).delete();

  return { ok: true };
});

/**
 * Registra o acesso e devolve os privilégios efetivos.
 *
 * Também reaplica as claims: se o token do navegador estiver velho — conta
 * editada enquanto a sessão estava aberta —, é aqui que ele se acerta.
 */
export const registerLogin = onCall({ region: REGION }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Faça login para continuar.');

  const db = getFirestore();
  const ref = db.collection('adminUsers').doc(uid);
  const snap = await ref.get();

  if (!snap.exists) {
    throw new HttpsError('permission-denied', 'Esta conta não tem acesso ao painel.');
  }

  const profile = snap.data() as AdminUserDoc;
  if (!profile.active) {
    throw new HttpsError('permission-denied', 'Esta conta foi desativada.');
  }

  await applyStaffAccess(uid, profile.role, profile.permissions, profile.active);
  await ref.update({ lastLoginAt: new Date().toISOString() });

  return { uid, ...profile };
});
