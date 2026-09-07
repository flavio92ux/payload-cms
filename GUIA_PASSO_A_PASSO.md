# 🚀 Guia Prático e Didático: Payload CMS 3.x + Next.js do Zero

Bem-vindo ao guia de construção e manutenção da sua aplicação!

Neste guia, você vai aprender **passo a passo** como criar uma aplicação robusta, modular e fácil de manter usando **Payload CMS 3.x**, **Next.js (App Router)** e **PostgreSQL**.

---

## 📑 Sumário

1. [Entendendo a Arquitetura (Mental Model)](#1-entendendo-a-arquitetura-mental-model)
2. [Onde os Dados são Salvos no Banco de Dados?](#2-onde-os-dados-são-salvos-no-banco-de-dados)
3. [Passo 1: Criando a Coleção de Produtos (`Products`)](#passo-1-criando-a-coleção-de-produtos-products)
4. [Passo 2: Organizando o Diretório de Componentes (`src/components`)](#passo-2-organizando-o-diretório-de-componentes-srccomponents)
5. [Passo 3: Criando as Páginas no Frontend (`src/app/(frontend)`)](#passo-3-criando-as-páginas-no-frontend-srcappfrontend)
6. [Passo 4: SEO Dinâmico e Schema.org (Google Rich Snippets)](#passo-4-seo-dinâmico-e-schemaorg-google-rich-snippets)
7. [Passo 5: Sitemap Dinâmico Automático (`sitemap.ts`)](#passo-5-sitemap-dinâmico-automático-sitemapts)
8. [Passo 6: Checklist de Limpeza e Primeiros Testes](#passo-6-checklist-de-limpeza-e-primeiros-testes)
9. [Dicas de Manutenção e Comandos Essenciais](#dicas-de-manutenção-e-comandos-essenciais)

---

## 1. Entendendo a Arquitetura (Mental Model)

No Payload 3.x, **não existe um servidor backend separado**. O Payload roda nativamente **dentro** do próprio Next.js:

```
src/
├── app/
│   ├── (payload)/       <-- Painel Administrativo (/admin e rotas da API)
│   └── (frontend)/      <-- Seu Site Público (onde seus clientes navegam)
├── collections/         <-- Definição dos seus modelos de dados (schemas)
├── components/          <-- Seus componentes React reutilizáveis
└── payload.config.ts    <-- Configuração central do Payload
```

### Como o Frontend busca dados? (Local API)
Diferente de outros CMSs headless onde você precisa fazer chamadas `fetch('https://api.../products')`, no Payload 3.x nós usamos a **Local API** dentro dos Server Components do Next.js:

```tsx
import { getPayload } from 'payload'
import config from '@payload-config'

const payload = await getPayload({ config })
const produtos = await payload.find({
  collection: 'products',
  where: { status: { equals: 'published' } },
})
```
> **Vantagens**:
> 1. Consulta o banco PostgreSQL **diretamente**, sem latência de rede HTTP.
> 2. Totalmente tipado com TypeScript (`payload-types.ts`).
> 3. Roda 100% no servidor (segurança máxima, sem expor segredos).

---

## 2. Onde os Dados são Salvos no Banco de Dados?

O seu projeto usa o adaptador `@payloadcms/db-postgres` conectado ao PostgreSQL rodando no Docker.

### O que acontece quando você cria uma Collection?
Quando você cria um arquivo `src/collections/Products.ts` e o registra no `payload.config.ts`:
1. **Tabela Principal**: O Payload cria automaticamente uma tabela no PostgreSQL chamada `products`.
2. **Colunas Simples**: Campos como `title`, `price` e `status` viram colunas na tabela (`varchar`, `numeric`, etc.).
3. **Campos Complexos (RichText)**: O editor Lexical salva uma árvore JSON estruturada dentro de uma coluna do tipo `jsonb`.
4. **Relacionamentos e Imagens**: Se o produto possui uma imagem da coleção `media`, o banco salva apenas o ID dessa imagem. O Payload resolve esse ID automaticamente quando você faz consultas (através do parâmetro `depth`).
5. **Sincronização em Dev**: Em ambiente de desenvolvimento, o Payload sincroniza o schema do banco automaticamente ao reiniciar o servidor.

---

## Passo 1: Criando a Coleção de Produtos (`Products`)

Vamos criar a estrutura no painel administrativo para cadastrar produtos com:
- Título, Slug amigável (URL), Preço, Status (Rascunho/Publicado).
- Imagem Principal e Galeria de Fotos.
- Descrição formatada (RichText com Lexical).
- Aba de SEO (Meta Título, Meta Descrição, Imagem Social).

### 1.1. Crie o arquivo `src/collections/Products.ts`

Crie o arquivo com o seguinte conteúdo:

```ts
import type { CollectionConfig } from 'payload'

export const Products: CollectionConfig = {
  slug: 'products',
  labels: {
    singular: 'Produto',
    plural: 'Produtos',
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'price', 'status', 'updatedAt'],
  },
  // IMPORTANTE: Permitir que o público sem login possa ler os produtos no frontend
  access: {
    read: () => true,
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Geral',
          fields: [
            {
              name: 'title',
              type: 'text',
              label: 'Nome do Produto',
              required: true,
            },
            {
              name: 'slug',
              type: 'text',
              label: 'Slug (URL amigável)',
              required: true,
              unique: true,
              admin: {
                description: 'Identificador único na URL (ex: "tenis-esportivo-preto")',
              },
              hooks: {
                beforeValidate: [
                  ({ data, value }) => {
                    // Se o slug não for preenchido manualmente, gera automaticamente a partir do título
                    if (!value && data?.title) {
                      return data.title
                        .toLowerCase()
                        .normalize('NFD')
                        .replace(/[\u0300-\u036f]/g, '')
                        .replace(/[^a-z0-9]+/g, '-')
                        .replace(/(^-|-$)+/g, '')
                    }
                    return value
                  },
                ],
              },
            },
            {
              name: 'price',
              type: 'number',
              label: 'Preço (R$)',
              required: true,
              min: 0,
            },
            {
              name: 'status',
              type: 'select',
              label: 'Status de Publicação',
              defaultValue: 'draft',
              options: [
                { label: 'Rascunho', value: 'draft' },
                { label: 'Publicado', value: 'published' },
              ],
              admin: {
                position: 'sidebar',
              },
            },
            {
              name: 'image',
              type: 'upload',
              relationTo: 'media',
              label: 'Imagem Principal',
              required: true,
            },
            {
              name: 'gallery',
              type: 'array',
              label: 'Galeria de Fotos Adicionais',
              fields: [
                {
                  name: 'image',
                  type: 'upload',
                  relationTo: 'media',
                  required: true,
                },
              ],
            },
            {
              name: 'description',
              type: 'richText',
              label: 'Descrição Detalhada do Produto',
            },
          ],
        },
        {
          label: 'SEO',
          fields: [
            {
              name: 'metaTitle',
              type: 'text',
              label: 'Título da Página (Meta Title)',
              admin: {
                description: 'Recomendado: 50 a 60 caracteres. Se vazio, o nome do produto será usado.',
              },
            },
            {
              name: 'metaDescription',
              type: 'textarea',
              label: 'Descrição para o Google (Meta Description)',
              admin: {
                description: 'Recomendado: 120 a 160 caracteres. Resumo atrativo para cliques.',
              },
            },
            {
              name: 'metaImage',
              type: 'upload',
              relationTo: 'media',
              label: 'Imagem para Redes Sociais (OpenGraph)',
              admin: {
                description: 'Imagem compartilhada no WhatsApp, Facebook, etc.',
              },
            },
          ],
        },
      ],
    },
  ],
}
```

---

### 1.2. Registre a coleção no `src/payload.config.ts`

Abra o arquivo `src/payload.config.ts`, importe a nova coleção e adicione no array `collections`:

```ts
// 1. Importe a coleção:
import { Products } from './collections/Products'

export default buildConfig({
  // ...
  // 2. Adicione no array de collections:
  collections: [Users, Media, Products],
  // ...
})
```

---

### 1.3. Gere os Tipos TypeScript

Sempre que criar ou alterar uma coleção, rode este comando no terminal para atualizar os tipos automáticos:

```bash
npm run generate:types
```
Isso atualizará o arquivo `src/payload-types.ts`, garantindo auto-complete perfeito para seus componentes!

---

## Passo 2: Organizando o Diretório de Componentes (`src/components`)

Para manter o código limpo, profissional e fácil de dar manutenção, organize a pasta `src/components/` assim:

```
src/
└── components/
    ├── ui/                 <-- Componentes genéricos de UI
    │   ├── RichText.tsx    <-- Renderizador de texto formatado (Lexical)
    │   └── Price.tsx       <-- Formatador de moeda (R$)
    ├── products/           <-- Componentes específicos de Produtos
    │   ├── ProductCard.tsx
    │   └── ProductGallery.tsx
    └── layout/             <-- Estrutura de layout (Header, Footer)
        ├── Header.tsx
        └── Footer.tsx
```

Vamos criar cada um desses componentes:

### 2.1. `src/components/ui/RichText.tsx`
Renderiza o conteúdo do editor Lexical de forma segura:

```tsx
import { RichText as PayloadRichText } from '@payloadcms/richtext-lexical/react'
import React from 'react'

type Props = {
  data: any
  className?: string
}

export function RichText({ data, className = '' }: Props) {
  if (!data) return null
  return (
    <div className={`prose max-w-none ${className}`}>
      <PayloadRichText data={data} />
    </div>
  )
}
```

### 2.2. `src/components/ui/Price.tsx`
Formata números no padrão monetário brasileiro (BRL):

```tsx
import React from 'react'

type Props = {
  amount: number
  className?: string
}

export function Price({ amount, className = '' }: Props) {
  const formatted = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(amount)

  return <span className={className}>{formatted}</span>
}
```

### 2.3. `src/components/products/ProductCard.tsx`
Card de exibição do produto para listas e catálogo:

```tsx
import Link from 'next/link'
import Image from 'next/image'
import React from 'react'
import type { Product, Media } from '@/payload-types'
import { Price } from '../ui/Price'

type Props = {
  product: Product
}

export function ProductCard({ product }: Props) {
  // A imagem principal vem da relação com a coleção 'media'
  const image = typeof product.image === 'object' ? (product.image as Media) : null

  return (
    <div className="product-card">
      <Link href={`/produtos/${product.slug}`} className="product-card-link">
        <div className="product-card-image-wrapper">
          {image?.url ? (
            <Image
              src={image.url}
              alt={image.alt || product.title}
              width={image.width || 400}
              height={image.height || 400}
              className="product-card-image"
            />
          ) : (
            <div className="product-card-placeholder">Sem imagem</div>
          )}
        </div>
        <div className="product-card-info">
          <h3 className="product-card-title">{product.title}</h3>
          <Price amount={product.price} className="product-card-price" />
        </div>
      </Link>
    </div>
  )
}
```

### 2.4. `src/components/products/ProductGallery.tsx`
Exibe a imagem principal e miniaturas clicáveis:

```tsx
'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import type { Media } from '@/payload-types'

type Props = {
  mainImage: Media | null
  gallery?: { image: string | Media; id?: string | null }[] | null
  title: string
}

export function ProductGallery({ mainImage, gallery, title }: Props) {
  // Concatena imagem principal + fotos da galeria
  const allImages: Media[] = []
  if (mainImage?.url) allImages.push(mainImage)

  if (gallery) {
    for (const item of gallery) {
      if (typeof item.image === 'object' && item.image?.url) {
        allImages.push(item.image as Media)
      }
    }
  }

  const [selectedIndex, setSelectedIndex] = useState(0)
  const currentImage = allImages[selectedIndex] || mainImage

  if (!currentImage?.url) {
    return <div className="gallery-placeholder">Sem foto disponível</div>
  }

  return (
    <div className="product-gallery">
      <div className="gallery-main">
        <Image
          src={currentImage.url}
          alt={currentImage.alt || title}
          width={currentImage.width || 600}
          height={currentImage.height || 600}
          priority
          className="gallery-main-image"
        />
      </div>

      {allImages.length > 1 && (
        <div className="gallery-thumbnails">
          {allImages.map((img, index) => (
            <button
              key={img.id || index}
              type="button"
              onClick={() => setSelectedIndex(index)}
              className={`thumbnail-btn ${selectedIndex === index ? 'active' : ''}`}
            >
              <Image
                src={img.url!}
                alt={img.alt || `${title} foto ${index + 1}`}
                width={80}
                height={80}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

### 2.5. `src/components/layout/Header.tsx`
Cabeçalho de navegação padrão:

```tsx
import Link from 'next/link'
import React from 'react'

export function Header() {
  return (
    <header className="site-header">
      <div className="container header-container">
        <Link href="/" className="logo">
          <strong>Minha Loja</strong>
        </Link>
        <nav className="nav-links">
          <Link href="/">Início</Link>
          <Link href="/produtos">Produtos</Link>
          <Link href="/admin" target="_blank">Painel Admin</Link>
        </nav>
      </div>
    </header>
  )
}
```

### 2.6. Estilos CSS Modernos e Responsivos

Para que seus componentes já fiquem com um visual moderno, limpo e responsivo, adicione estes estilos ao final do arquivo `src/app/(frontend)/styles.css`:

```css
/* ==========================================
   ESTILOS DE PRODUTOS E LAYOUT
   ========================================== */

.container {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1.5rem;
}

.py-8 {
  padding-top: 2.5rem;
  padding-bottom: 2.5rem;
}

/* Header */
.site-header {
  border-bottom: 1px solid #222;
  padding: 1rem 0;
  background: #0a0a0a;
}

.header-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.nav-links {
  display: flex;
  gap: 1.5rem;
}

.nav-links a {
  text-decoration: none;
  opacity: 0.8;
  transition: opacity 0.2s;
}

.nav-links a:hover {
  opacity: 1;
}

/* Grid de Produtos */
.products-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 2rem;
  margin-top: 2rem;
}

/* Card do Produto */
.product-card {
  background: #111;
  border: 1px solid #222;
  border-radius: 12px;
  overflow: hidden;
  transition: transform 0.2s, border-color 0.2s;
}

.product-card:hover {
  transform: translateY(-4px);
  border-color: #444;
}

.product-card-link {
  text-decoration: none;
  display: block;
}

.product-card-image-wrapper {
  position: relative;
  width: 100%;
  height: 280px;
  background: #1a1a1a;
  display: flex;
  align-items: center;
  justify-content: center;
}

.product-card-image {
  object-fit: cover;
  width: 100%;
  height: 100%;
}

.product-card-placeholder {
  color: #777;
  font-size: 0.9rem;
}

.product-card-info {
  padding: 1.25rem;
}

.product-card-title {
  font-size: 1.15rem;
  margin: 0 0 0.5rem 0;
  font-weight: 600;
}

.product-card-price {
  font-size: 1.2rem;
  font-weight: 700;
  color: #10b981; /* Verde esmeralda moderno */
}

/* Página de Detalhes do Produto */
.product-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3.5rem;
  align-items: start;
}

@media (max-width: 768px) {
  .product-layout {
    grid-template-columns: 1fr;
    gap: 2rem;
  }
}

/* Galeria */
.gallery-main {
  width: 100%;
  border-radius: 12px;
  overflow: hidden;
  background: #111;
  border: 1px solid #222;
}

.gallery-main-image {
  width: 100%;
  height: auto;
  object-fit: cover;
}

.gallery-thumbnails {
  display: flex;
  gap: 0.75rem;
  margin-top: 1rem;
  overflow-x: auto;
}

.thumbnail-btn {
  background: transparent;
  border: 2px solid transparent;
  border-radius: 8px;
  padding: 2px;
  cursor: pointer;
  overflow: hidden;
  opacity: 0.6;
  transition: all 0.2s;
}

.thumbnail-btn.active,
.thumbnail-btn:hover {
  opacity: 1;
  border-color: #10b981;
}

.thumbnail-btn img {
  border-radius: 6px;
  object-fit: cover;
}

/* Detalhes e Botões de Compra */
.product-price-large {
  display: block;
  font-size: 2rem;
  font-weight: 800;
  color: #10b981;
  margin: 1rem 0 2rem 0;
}

.product-actions {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
}

.btn-buy, .btn-cart {
  padding: 0.85rem 1.75rem;
  border-radius: 8px;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  border: none;
  transition: filter 0.2s;
}

.btn-buy {
  background: #10b981;
  color: #000;
}

.btn-cart {
  background: #222;
  color: #fff;
  border: 1px solid #333;
}

.btn-buy:hover, .btn-cart:hover {
  filter: brightness(1.15);
}

.divider {
  border: none;
  border-top: 1px solid #222;
  margin: 2rem 0;
}
```

---

## Passo 3: Criando as Páginas no Frontend (`src/app/(frontend)`)

No Next.js com App Router, pastas definem URLs.

### 3.1. Listagem de Produtos (`src/app/(frontend)/produtos/page.tsx`)

Crie a página de catálogo onde todos os produtos publicados são listados:

```tsx
import React from 'react'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Metadata } from 'next'
import { ProductCard } from '@/components/products/ProductCard'
import type { Product } from '@/payload-types'

export const metadata: Metadata = {
  title: 'Catálogo de Produtos',
  description: 'Conheça todos os nossos produtos exclusivos.',
}

export default async function ProductsCatalogPage() {
  const payload = await getPayload({ config })

  // Busca apenas os produtos com status 'published'
  const { docs: products } = await payload.find({
    collection: 'products',
    where: {
      status: {
        equals: 'published',
      },
    },
    depth: 1, // depth 1 garante que a relação de imagem venha preenchida com o objeto Media
    sort: '-createdAt',
  })

  return (
    <div className="container py-8">
      <h1 className="page-title">Nossos Produtos</h1>
      <p className="page-subtitle">Confira nossa seleção completa</p>

      {products.length === 0 ? (
        <div className="empty-state">
          <p>Nenhum produto publicado no momento.</p>
          <p>Acesse o painel administrativo para cadastrar e publicar produtos.</p>
        </div>
      ) : (
        <div className="products-grid">
          {products.map((product) => (
            <ProductCard key={product.id} product={product as Product} />
          ))}
        </div>
      )}
    </div>
  )
}
```

---

### 3.2. Página de Detalhes do Produto (`src/app/(frontend)/produtos/[slug]/page.tsx`)

Esta é a página individual de cada produto (ex: `/produtos/fone-bluetooth`).

> ⚠️ **Atenção Next.js 15/16**: Em versões recentes do Next.js, a prop `params` é uma `Promise`, portanto você deve fazer `const { slug } = await params`.

```tsx
import React from 'react'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Metadata } from 'next'
import type { Media, Product } from '@/payload-types'
import { ProductGallery } from '@/components/products/ProductGallery'
import { Price } from '@/components/ui/Price'
import { RichText } from '@/components/ui/RichText'

type Props = {
  params: Promise<{ slug: string }>
}

// 1. Função que busca o produto pelo slug
async function getProductBySlug(slug: string): Promise<Product | null> {
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'products',
    where: {
      slug: {
        equals: slug,
      },
      status: {
        equals: 'published',
      },
    },
    depth: 2, // depth 2 para carregar imagens da galeria e imagem principal completas
    limit: 1,
  })

  return (result.docs[0] as Product) || null
}

// 2. SEO Dinâmico (OpenGraph, Metatags)
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const product = await getProductBySlug(slug)

  if (!product) return {}

  const metaTitle = product.metaTitle || `${product.title} | Minha Loja`
  const metaDescription = product.metaDescription || `Confira os detalhes de ${product.title}`
  const metaImage = typeof product.metaImage === 'object' 
    ? (product.metaImage as Media)?.url 
    : typeof product.image === 'object' 
    ? (product.image as Media)?.url 
    : undefined

  return {
    title: metaTitle,
    description: metaDescription,
    openGraph: {
      title: metaTitle,
      description: metaDescription,
      images: metaImage ? [{ url: metaImage }] : [],
    },
  }
}

// 3. Opcional: Pré-renderização Estática (SSG) de todos os produtos conhecidos
export async function generateStaticParams() {
  const payload = await getPayload({ config })
  const { docs: products } = await payload.find({
    collection: 'products',
    where: { status: { equals: 'published' } },
    limit: 100,
  })

  return products.map((product) => ({
    slug: product.slug,
  }))
}

// 4. Componente da Página
export default async function ProductDetailPage({ params }: Props) {
  const { slug } = await params
  const product = await getProductBySlug(slug)

  if (!product) {
    notFound() // Redireciona automaticamente para a página 404
  }

  const mainImage = typeof product.image === 'object' ? (product.image as Media) : null

  // Schema.org para o Google entender que é um produto comercial (Rich Snippet)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    image: mainImage?.url,
    description: product.metaDescription || product.title,
    offers: {
      '@type': 'Offer',
      price: product.price,
      priceCurrency: 'BRL',
      availability: 'https://schema.org/InStock',
    },
  }

  return (
    <article className="container py-8">
      {/* Schema.org injetado para motores de busca */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="product-layout">
        {/* Coluna da Galeria */}
        <div className="product-layout-gallery">
          <ProductGallery
            mainImage={mainImage}
            gallery={product.gallery}
            title={product.title}
          />
        </div>

        {/* Coluna de Informações e Compra */}
        <div className="product-layout-info">
          <h1 className="product-title">{product.title}</h1>
          <Price amount={product.price} className="product-price-large" />

          <div className="product-actions">
            <button type="button" className="btn-buy">
              Comprar Agora
            </button>
            <button type="button" className="btn-cart">
              Adicionar ao Carrinho
            </button>
          </div>

          <hr className="divider" />

          <div className="product-description-section">
            <h2>Sobre o produto</h2>
            {product.description ? (
              <RichText data={product.description} />
            ) : (
              <p className="text-muted">Sem descrição disponível.</p>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}
```

---

## Passo 4: SEO Dinâmico e Schema.org (Google Rich Snippets)

O código acima já inclui duas estratégias fundamentais de SEO:

1. **`generateMetadata`**:
   - Informa ao navegador e redes sociais o título exato da página, descrição e imagem de destaque.
   - Quando alguém enviar o link no WhatsApp ou Twitter, a imagem do produto e o resumo aparecerão bonitos.

2. **Google Rich Snippet (`jsonLd`)**:
   - Através do bloco `<script type="application/ld+json">`, informamos ao robô do Google o nome, preço em Reais (BRL) e disponibilidade de estoque. Isso faz com que o preço apareça diretamente nos resultados de busca do Google!

---

## Passo 5: Sitemap Dinâmico Automático (`sitemap.ts`)

O Next.js permite criar um `sitemap.xml` dinâmico simplesmente adicionando um arquivo `src/app/sitemap.ts`.

Crie o arquivo `src/app/sitemap.ts`:

```ts
import type { MetadataRoute } from 'next'
import { getPayload } from 'payload'
import config from '@payload-config'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const payload = await getPayload({ config })

  // 1. Busca todos os produtos publicados
  const { docs: products } = await payload.find({
    collection: 'products',
    where: {
      status: {
        equals: 'published',
      },
    },
    limit: 1000,
  })

  // 2. Mapeia os produtos para entradas de sitemap
  const productEntries: MetadataRoute.Sitemap = products.map((product) => ({
    url: `${siteUrl}/produtos/${product.slug}`,
    lastModified: new Date(product.updatedAt),
    changeFrequency: 'weekly',
    priority: 0.8,
  }))

  // 3. Páginas estáticas principais
  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: `${siteUrl}`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${siteUrl}/produtos`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
  ]

  return [...staticEntries, ...productEntries]
}
```

> **Para testar**: Basta acessar no navegador `http://localhost:3000/sitemap.xml`. Todos os produtos cadastrados estarão listados lá para os robôs de busca!

---

## Passo 6: Checklist de Limpeza e Primeiros Testes

Agora que você tem o passo a passo completo em mãos, siga esta ordem para criar e testar tudo do zero:

### 1. Criar a Coleção
- [ ] Crie `src/collections/Products.ts`.
- [ ] Adicione `Products` no array `collections` de `src/payload.config.ts`.
- [ ] No terminal, execute `npm run generate:types`.

### 2. Criar os Componentes
- [ ] Crie a pasta `src/components/ui/` com `RichText.tsx` e `Price.tsx`.
- [ ] Crie a pasta `src/components/products/` com `ProductCard.tsx` e `ProductGallery.tsx`.
- [ ] Crie a pasta `src/components/layout/` com `Header.tsx`.

### 3. Criar as Rotas
- [ ] Crie a pasta `src/app/(frontend)/produtos/page.tsx`.
- [ ] Crie a pasta `src/app/(frontend)/produtos/[slug]/page.tsx`.
- [ ] Crie `src/app/sitemap.ts`.
- [ ] Atualize `src/app/(frontend)/layout.tsx` para incluir o `<Header />`.

### 4. Cadastrar no Painel Administrativo
- [ ] Abra `http://localhost:3000/admin`.
- [ ] Se ainda não criou um usuário admin, a tela pedirá para criar o primeiro usuário.
- [ ] No menu lateral esquerdo, clique em **Produtos** -> **Criar novo**.
- [ ] Preencha:
  - Nome: `Tênis Esportivo Pro`
  - Slug: preenche automaticamente ou digite `tenis-esportivo-pro`
  - Preço: `299.90`
  - Status: Mude para **Publicado**
  - Imagem Principal: Faça o upload de uma imagem
  - Descrição: Adicione parágrafos, tópicos ou títulos
  - Na aba SEO: Preencha o resumo para redes sociais
  - Clique em **Salvar**.

### 5. Ver no Frontend
- [ ] Abra `http://localhost:3000/produtos` e veja o card do seu produto!
- [ ] Clique no produto ou acesse `http://localhost:3000/produtos/tenis-esportivo-pro` para ver a página de detalhes completa.
- [ ] Acesse `http://localhost:3000/sitemap.xml` para conferir a indexação.

---

## Dicas de Manutenção e Comandos Essenciais

### 💡 Como funcionam as Migrações no Banco?
- Em desenvolvimento (`npm run dev`), o Payload sincroniza as tabelas automaticamente.
- Para produção, o Payload possui o sistema `payload migrate:create` e `payload migrate` caso queira controlar mudanças de schema de forma estrita.

### 💡 Por que minhas imagens não aparecem?
Lembre-se sempre de conferir a permissão na coleção `Media.ts`:
```ts
access: {
  read: () => true, // Necessário para imagens serem públicas
}
```

### 💡 O que é o parâmetro `depth` no `find`?
- `depth: 0`: O Payload retorna apenas o ID da imagem (ex: `"image": "65b9..."`).
- `depth: 1` ou `depth: 2`: O Payload busca o documento completo na coleção relacionada (ex: `"image": { "url": "/media/foto.png", "alt": "Tênis" }`).

---
Pronto! Você agora possui uma base profissional, escalável e de fácil manutenção no Payload 3.x!
