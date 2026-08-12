export interface Product {
  id: string;
  name: string;
  category: 'Oversized' | 'Vintage Trash' | 'Graphic Tees' | 'Edição Limitada';
  price: number;
  oldPrice?: number;
  sizes: ('P' | 'M' | 'G' | 'GG' | 'XGG')[];
  image: string;
  tag?: 'Bestseller' | 'Novo' | 'Promoção' | 'Raro';
  rating: number;
  reviewsCount: number;
  description: string;
  details: string[];
}

export const PRODUCTS: Product[] = [
  {
    id: '1',
    name: 'Camiseta Anarchy & Chaos Oversized',
    category: 'Oversized',
    price: 139.90,
    oldPrice: 169.90,
    sizes: ['P', 'M', 'G', 'GG', 'XGG'],
    image: 'https://images.unsplash.com/photo-1576995853123-5a10305d93c0?auto=format&fit=crop&w=800&q=80',
    tag: 'Bestseller',
    rating: 4.9,
    reviewsCount: 128,
    description: 'Estampa brutal inspirada na cultura punk dos anos 80. Caimento oversized encorpado para um visual underground marcante.',
    details: [
      'Algodão 100% Premium 260g/m² (Fio 30.1 Penteado)',
      'Estampa Silk Screen em Relevo com tinta Plastisol',
      'Gola de 3cm com ribana canelada de alta gramatura',
      'Modelagem Streetwear Oversized com ombro caído'
    ]
  },
  {
    id: '2',
    name: 'Camiseta Cyber Skull Glitch',
    category: 'Graphic Tees',
    price: 129.90,
    sizes: ['P', 'M', 'G', 'GG'],
    image: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=800&q=80',
    tag: 'Novo',
    rating: 4.8,
    reviewsCount: 64,
    description: 'Design de crânio neon com interferência digital. Perfeita para quem vive a noite e a cultura rave/cyberpunk.',
    details: [
      'Algodão 100% Pré-encolhido',
      'Estampa Digital DTG de altíssima definição',
      'Costura dupla reforçada de ombro a ombro',
      'Toque macio com caimento leve'
    ]
  },
  {
    id: '3',
    name: 'Camiseta Acid Washed Cemetery',
    category: 'Vintage Trash',
    price: 149.90,
    oldPrice: 179.90,
    sizes: ['M', 'G', 'GG', 'XGG'],
    image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=800&q=80',
    tag: 'Raro',
    rating: 5.0,
    reviewsCount: 89,
    description: 'Processo exclusivo de lavagem ácida artesanal. Nenhuma peça é igual à outra. Visual estonado e desgastado autêntico.',
    details: [
      'Lavagem artesanal Acid Wash exclusiva',
      'Algodão Heavy Weight 280g/m²',
      'Efeito envelhecido vintage com barras levemente desfiadas',
      'Edição numerada e limitada'
    ]
  },
  {
    id: '4',
    name: 'Camiseta Imunda Protocol - Ed. Lim. 001',
    category: 'Edição Limitada',
    price: 189.90,
    sizes: ['P', 'M', 'G', 'GG'],
    image: 'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?auto=format&fit=crop&w=800&q=80',
    tag: 'Raro',
    rating: 4.9,
    reviewsCount: 215,
    description: 'A joia da coroa da ImundasStore. Apenas 100 unidades produzidas mundialmente. Acompanha tag em metal gravado a laser.',
    details: [
      'Tecido Ultra Premium 300g/m²',
      'Tag metálica de colecionador com número de série',
      'Patch frontal bordado em alta densidade',
      'Embalagem personalizada em saco estanque tático'
    ]
  },
  {
    id: '5',
    name: 'Camiseta Industrial Noise Toxic',
    category: 'Oversized',
    price: 119.90,
    oldPrice: 149.90,
    sizes: ['P', 'M', 'G', 'GG', 'XGG'],
    image: 'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?auto=format&fit=crop&w=800&q=80',
    tag: 'Promoção',
    rating: 4.7,
    reviewsCount: 42,
    description: 'Grafismo brutalista inspirado em sinalizações industriais abandonadas e estética post-punk.',
    details: [
      '100% Algodão penteado premium',
      'Estampa em silk com detalhes em tinta fotoluminescente',
      'Modelagem boxy moderna',
      'Resistente a múltiplas lavagens sem desbotar'
    ]
  },
  {
    id: '6',
    name: 'Camiseta Dark Botanical Poison',
    category: 'Graphic Tees',
    price: 124.90,
    sizes: ['P', 'M', 'G', 'GG'],
    image: 'https://images.unsplash.com/photo-1562157873-818bc0726f68?auto=format&fit=crop&w=800&q=80',
    tag: 'Novo',
    rating: 4.8,
    reviewsCount: 37,
    description: 'Ilustração botânica gótica com serpentes e plantas venenosas em traços botânicos do século XIX.',
    details: [
      'Algodão 100% macio e respirável',
      'Impressão serigráfica em monocromia alta precisão',
      'Corte reto e confortável',
      'Gola reforçada que não alarga'
    ]
  },
  {
    id: '7',
    name: 'Camiseta Raw Concrete Grunge',
    category: 'Vintage Trash',
    price: 139.90,
    sizes: ['M', 'G', 'GG', 'XGG'],
    image: 'https://images.unsplash.com/photo-1529374255404-311a2a4f1fd9?auto=format&fit=crop&w=800&q=80',
    tag: 'Bestseller',
    rating: 4.9,
    reviewsCount: 94,
    description: 'Pigmentação cinza concreto com técnica de tingimento pigment wash para um visual urbano minimalista e cru.',
    details: [
      'Tingimento especial Pigment Wash',
      'Tecido super macio ao toque',
      'Modelagem relaxed fit',
      'Logo sutil bordado no peito'
    ]
  },
  {
    id: '8',
    name: 'Camiseta Anti-System Distorted',
    category: 'Edição Limitada',
    price: 159.90,
    oldPrice: 189.90,
    sizes: ['P', 'M', 'G', 'GG'],
    image: 'https://images.unsplash.com/photo-1622445268465-843d63d03713?auto=format&fit=crop&w=800&q=80',
    tag: 'Promoção',
    rating: 4.9,
    reviewsCount: 156,
    description: 'Tipografia desconstruída e distorcida expressando a recusa do comum. Estética streetwear de vanguarda.',
    details: [
      'Algodão pesado 240g/m²',
      'Estampa frente e costas em Silk Screen',
      'Etiqueta interna estampada para maior conforto',
      'Edição limitada com poucas unidades restantes'
    ]
  }
];
