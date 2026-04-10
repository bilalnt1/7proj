/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface City {
  name: string;
  price: number;
}

export interface Product {
  w_code: string;
  title: string;
  category: string;
  images: string[];
  description: string;
  features?: string;
  how_to_use?: string;
  box_contents?: string;
  colors?: string;
  sizes?: string;
  sell_price: string;
  status: string;
  stock_status: string;
}

export interface AppState {
  products: Product[];
  filteredProducts: Product[];
  categories: string[];
  selectedCategory: string;
  searchQuery: string;
  selectedProduct: Product | null;
  isModalOpen: boolean;
  isSubmitting: boolean;
  isSuccess: boolean;
}
