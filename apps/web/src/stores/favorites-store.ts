import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface FavoritesState {
  productIds: string[];
  toggle: (productId: string) => void;
}

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set) => ({
      productIds: [],
      toggle: (productId) =>
        set((state) => ({
          productIds: state.productIds.includes(productId)
            ? state.productIds.filter((id) => id !== productId)
            : [...state.productIds, productId],
        })),
    }),
    { name: 'sheri-gold-demo-favorites' }
  )
);
