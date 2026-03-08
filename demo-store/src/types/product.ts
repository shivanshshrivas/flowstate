// Demo-store local Product type (not part of the gateway package)
export interface Product {
  id: string;
  name: string;
  description: string;
  price_usd: number;
  weight_oz: number;
  dimensions: { length: number; width: number; height: number };
  seller_id: string;
  seller_name?: string;
  seller_wallet?: string;
  image_url: string;
  category: string;
  stock: number;
}
