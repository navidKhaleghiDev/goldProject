import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CartState {
  productIds: string[];
  add: (productId: string) => void;
  remove: (productId: string) => void;
  has: (productId: string) => boolean;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      productIds: [],
      add: (productId) =>
        set((state) => ({
          productIds: state.productIds.includes(productId)
            ? state.productIds
            : [...state.productIds, productId],
        })),
      remove: (productId) =>
        set((state) => ({ productIds: state.productIds.filter((id) => id !== productId) })),
      has: (productId) => get().productIds.includes(productId),
    }),
    { name: 'sheri-gold-demo-cart' }
  )
);
