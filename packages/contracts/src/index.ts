export type UserRole = 'customer' | 'admin';
export interface SessionUser {
  id: string;
  fullName: string;
  phone: string;
  role: UserRole;
  trusted: boolean;
  avatarUrl?: string | null;
}
export interface GoldRates {
  buyTomanPerGram: number;
  sellTomanPerGram: number;
  updatedAt: string;
  serverTime: string;
  purity: string;
  isDemo: boolean;
  lockSeconds: number;
  minWeightMg: number;
  maxWeightMg: number;
}
export interface GoldWallet {
  availableMg: number;
  frozenMg: number;
}
export interface GoldQuote {
  id: string;
  kind: 'buy' | 'sell';
  weightMg: number;
  rateToman: number;
  totalToman: number;
  purity: string;
  isDemo: boolean;
  expiresAt: string;
  serverTime: string;
}
export type GoldTransactionStatus =
  'awaiting_payment' | 'payment_submitted' | 'admin_review' | 'completed' | 'rejected';
export interface GoldTransaction {
  serverTime: string;
  id: string;
  userId: string;
  customerName: string;
  kind: 'buy' | 'sell';
  status: GoldTransactionStatus;
  weightMg: number;
  rateToman: number;
  totalToman: number;
  purity: string;
  isDemo: boolean;
  paymentInstructions: string;
  expiresAt: string;
  createdAt: string;
  latePayment: boolean;
  rejectionReason: string | null;
  settlementAcknowledgement: string | null;
  hasReceipt: boolean;
  history: { status: string; note: string | null; createdAt: string }[];
}
export type ProductAvailability = 'available' | 'unavailable';
export type PurchaseRequestStatus = 'new' | 'following_up' | 'agreed' | 'completed' | 'cancelled';
export type SupplyRequestStatus =
  'new' | 'reviewing' | 'available_to_supply' | 'unavailable_to_supply' | 'cancelled';

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    fields?: Record<string, string[]>;
    requestId: string;
  };
}

export interface CategoryDto {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
}

export interface ProductImageDto {
  id: string;
  url: string;
  alt: string;
  position: number;
}

export interface ProductDto {
  id: string;
  code: string;
  name: string;
  category: CategoryDto;
  shortDescription: string;
  description: string;
  priceToman: number;
  weightGrams: number | null;
  purity: string | null;
  availability: ProductAvailability;
  images: ProductImageDto[];
  updatedAt: string;
}

export interface ProductListDto {
  items: ProductDto[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface MarketRatesDto {
  gold18TomanPerGram: number;
  silver999TomanPerGram: number;
  isDemo: true;
  updatedAt: string;
}
