import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import {
  ALL_PERMISSIONS,
  ROLE_PERMISSIONS,
  type AdminUserDoc,
  type Permission,
  type Role,
} from './domain.js';

/**
 * O que vai na custom claim do token. Mantido enxuto de propósito: claims têm
 * teto de 1000 bytes e viajam em toda requisição.
 */
export interface StaffClaims {
  role: Role;
  perms: Permission[];
  active: boolean;
}

/** Exige um usuário autenticado com o privilégio pedido. */
export async function requirePermission(
  request: CallableRequest,
  permission: Permission,
): Promise<{ uid: string; claims: StaffClaims }> {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Faça login para continuar.');
  }

  // Claims aceleram a interface, mas podem ficar em cache depois de uma
  // revogação. Operações privilegiadas consultam o perfil atual para que
  // desativação/corte de permissão tenha efeito imediato.
  const snap = await getFirestore().collection('adminUsers').doc(uid).get();
  if (!snap.exists) {
    throw new HttpsError('permission-denied', 'Esta conta não pertence à equipe.');
  }
  const profile = snap.data() as AdminUserDoc;
  const perms = Array.isArray(profile.permissions) ? profile.permissions : [];

  if (profile.active !== true) {
    throw new HttpsError('permission-denied', 'Esta conta está desativada.');
  }
  if (!perms.includes(permission)) {
    throw new HttpsError('permission-denied', `Falta o privilégio "${permission}".`);
  }

  return { uid, claims: { role: profile.role as Role, perms, active: true } };
}

/** Nome de quem executou a ação, para a trilha de auditoria. */
export async function actorName(uid: string): Promise<string> {
  const snap = await getFirestore().collection('adminUsers').doc(uid).get();
  return (snap.data() as AdminUserDoc | undefined)?.name ?? 'sistema';
}

/**
 * Grava cargo e privilégios no documento e na claim de uma vez.
 *
 * As duas coisas precisam andar juntas: o documento alimenta a tela e a claim
 * alimenta as regras de segurança. Se divergirem, a interface mostra um
 * privilégio que o banco recusa — ou pior, o contrário.
 */
export async function applyStaffAccess(
  uid: string,
  role: Role,
  permissions: Permission[],
  active: boolean,
): Promise<Permission[]> {
  // Só privilégios conhecidos entram, e sem repetição.
  const clean = [...new Set(permissions)].filter((p) =>
    ALL_PERMISSIONS.includes(p),
  ) as Permission[];

  // O Mestre não pode ser reduzido: a loja precisa de pelo menos um dono
  // absoluto, senão uma edição infeliz tranca todo mundo para fora.
  const effective = role === 'mestre' ? ROLE_PERMISSIONS.mestre : clean;
  const effectiveActive = role === 'mestre' ? true : active;

  const claims: StaffClaims = { role, perms: effective, active: effectiveActive };
  await getAuth().setCustomUserClaims(uid, claims);

  return effective;
}
