/**
 * Cloud Functions — Camisetas Insanas.
 *
 * Região `southamerica-east1` (São Paulo): a loja atende o Brasil, e manter
 * função e banco perto do cliente corta uns 150ms de latência por chamada.
 */
import { initializeApp } from 'firebase-admin/app';
import { setGlobalOptions } from 'firebase-functions/v2';

initializeApp();

setGlobalOptions({
  region: 'southamerica-east1',
  // Teto de instâncias: sem isso, um pico (ou um laço acidental) escala sem
  // limite e a conta chega junto.
  maxInstances: 10,
});

export {
  placeOrder,
  updateOrderStatus,
  setTrackingCode,
  lookupOrders,
  expirePendingOrders,
} from './orders.js';
export { saveProduct, deleteProduct, setStock } from './catalog.js';
export { saveStaff, deleteStaff, registerLogin } from './staff.js';
export { bootstrap, seedCatalog } from './bootstrap.js';
export { paymentWebhook, syncPayment } from './payments.js';
