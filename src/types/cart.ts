import type { Product } from '../data/products';

export interface CartItem {
  product: Product;
  selectedSize: 'P' | 'M' | 'G' | 'GG' | 'XGG';
  quantity: number;
}
