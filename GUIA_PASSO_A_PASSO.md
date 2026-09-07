# 🚀 Guia Definitivo: Payload CMS 3.x + Next.js + Tailwind CSS do Zero

Bem-vindo ao guia prático e didático da sua aplicação!

Neste documento, você aprenderá **passo a passo** como construir uma aplicação moderna, elegante e com estética premium utilizando:
- **Payload CMS 3.x** (Painel administrativo e Local API direta)
- **Next.js 16 (App Router)** (Renderização no servidor, rotas e SEO)
- **Tailwind CSS v4** (Design moderno, dark mode elegante e responsividade total)
- **PostgreSQL** (Banco de dados relacional robusto rodando no Docker)

---

## 📑 Sumário

1. [Entendendo a Arquitetura (Mental Model)](#1-entendendo-a-arquitetura-mental-model)
2. [Onde os Campos são Salvos no Banco de Dados?](#2-onde-os-campos-são-salvos-no-banco-de-dados)
3. [Passo 1: Criando a Coleção de Produtos (`Products`)](#passo-1-criando-a-coleção-de-produtos-products)
4. [Passo 2: Construindo Componentes com Tailwind CSS](#passo-2-construindo-componentes-com-tailwind-css)
   - [2.1. Price (Formatador de Moeda)](#21-srccomponentsuipricetsx)
   - [2.2. RichText (Renderizador Lexical)](#22-srccomponentsuirichtexttsx)
   - [2.3. Header & Layout](#23-srccomponentslayoutheadertsx)
   - [2.4. ProductCard (Card com Tailwind)](#24-srccomponentsproductsproductcardtsx)
   - [2.5. ProductGallery (Galeria Interativa)](#25-srccomponentsproductsproductgallerytsx)
5. [Passo 3: Criando as Páginas no Frontend (`src/app/(frontend)`)](#passo-3-criando-as-páginas-no-frontend-srcappfrontend)
   - [3.1. Layout Global](#31-atualizando-o-layout-global-srcappfrontendlayouttsx)
   - [3.2. Catálogo de Produtos](#32-catálogo-de-produtos-srcappfrontendprodutospagetsx)
   - [3.3. Página de Detalhes do Produto](#33-página-de-detalhes-do-produto-srcappfrontendprodutoslsquoslugrsquopagetsx)
6. [Passo 4: SEO Dinâmico e Google Rich Snippets (Schema.org)](#passo-4-seo-dinâmico-e-google-rich-snippets-schemaorg)
7. [Passo 5: Sitemap Dinâmico Automático (`sitemap.ts`)](#passo-5-sitemap-dinâmico-automático-sitemapts)
8. [Passo 6: Checklist de Limpeza e Execução](#passo-6-checklist-de-limpeza-e-execução)
9. [Dicas de Manutenção e Boas Práticas](#dicas-de-manutenção-e-boas-práticas)

---

## 1. Entendendo a Arquitetura (Mental Model)

No Payload 3.x, o CMS roda **dentro da mesma aplicação Next.js**, eliminando a necessidade de manter dois servidores ou fazer requisições HTTP lentas entre frontend e backend:

```
src/
├── app/
│   ├── (payload)/       <-- Painel Administrativo (/admin) e rotas da API
│   └── (frontend)/      <-- Seu Site Público estilizado com Tailwind CSS
├── collections/         <-- Definição das suas tabelas/coleções (Products, Users, Media)
├── components/          <-- Componentes React reutilizáveis estilizados com Tailwind
└── payload.config.ts    <-- Configuração central do Payload CMS
```

### Como o Frontend consome os dados? (Local API)
Nos Server Components do Next.js, nós utilizamos a **Local API** do Payload:

```tsx
import { getPayload } from 'payload'
import config from '@payload-config'

const payload = await getPayload({ config })
const { docs: produtos } = await payload.find({
  collection: 'products',
  where: { status: { equals: 'published' } },
  depth: 1, // depth 1 traz os objetos de imagens relacionados
})
```

> **Por que isso é incrível?**
> - **Zero overhead de rede**: Consulta o PostgreSQL diretamente no processo Node.js.
> - **Tipagem estrita**: Totalmente integrado aos tipos do TypeScript gerados automaticamente.
> - **Segurança**: Credenciais de banco e segredos nunca são expostos ao navegador do usuário.

---

## 2. Onde os Campos são Salvos no Banco de Dados?

Seu projeto usa o PostgreSQL rodando no Docker (`container_name: payload-postgres`).

- **Tabela `products`**: Criada automaticamente a partir da coleção `Products.ts`.
- **Colunas Primitivas**: `title`, `slug`, `price` e `status` viram colunas (`varchar`, `numeric`, etc.).
- **RichText (Lexical)**: Todo texto formatado (negrito, itálico, listas, links) é salvo como uma árvore de objetos JSON na coluna `description` do tipo `jsonb`.
- **Relações (Imagens)**: Quando você seleciona uma imagem, o banco armazena o ID do arquivo na tabela `media`. O Payload resolve isso automaticamente quando consultamos com `depth: 1` ou `depth: 2`.
- **Auto-Sync em Desenvolvimento**: Ao salvar alterações no arquivo de configuração, o Payload atualiza o esquema do banco de dados automaticamente.

---

## Passo 1: Criando a Coleção de Produtos (`Products`)

Vamos criar uma coleção completa com abas organizadas (**Geral** e **SEO**), autogeração de slug amigável e permissão de leitura pública.

### 1.1. Crie o arquivo `src/collections/Products.ts`

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
  // OBRIGATÓRIO: Permite que visitantes leiam os produtos no frontend público
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
                description: 'Gerado automaticamente se deixado em branco (ex: fone-bluetooth-pro)',
              },
              hooks: {
                beforeValidate: [
                  ({ data, value }) => {
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
              label: 'Galeria de Imagens Adicionais',
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
              label: 'Descrição Completa do Produto',
            },
          ],
        },
        {
          label: 'SEO',
          fields: [
            {
              name: 'metaTitle',
              type: 'text',
              label: 'Título SEO (Meta Title)',
              admin: {
                description: 'Se vazio, o título do produto será usado automaticamente.',
              },
            },
            {
              name: 'metaDescription',
              type: 'textarea',
              label: 'Descrição SEO (Meta Description)',
              admin: {
                description: 'Resumo atrativo para os resultados de busca do Google.',
              },
            },
            {
              name: 'metaImage',
              type: 'upload',
              relationTo: 'media',
              label: 'Imagem para Redes Sociais (OpenGraph)',
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

Abra o arquivo `src/payload.config.ts`, importe `Products` e adicione ao array `collections`:

```ts
import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Products } from './collections/Products' // <-- 1. Importe aqui

export default buildConfig({
  // ...
  collections: [Users, Media, Products], // <-- 2. Adicione aqui
  // ...
})
```

---

### 1.3. Gere os tipos TypeScript atualizados

Toda vez que adicionar ou modificar campos em uma coleção, rode no terminal:

```bash
npm run generate:types
```

Isso gera o tipo `Product` em `src/payload-types.ts`, garantindo que o VS Code sugira todos os campos com precisão cirúrgica.

---

## Passo 2: Construindo Componentes com Tailwind CSS

Vamos organizar a pasta de componentes de forma limpa e modular:

```
src/
└── components/
    ├── ui/
    │   ├── Price.tsx          <-- Moeda formatada com destaque visual
    │   └── RichText.tsx       <-- Renderizador de texto formatado (Lexical)
    ├── layout/
    │   ├── Header.tsx         <-- Navbar moderna com blur e links
    │   └── Footer.tsx         <-- Rodapé completo
    └── products/
        ├── ProductCard.tsx    <-- Card elegante com hover e imagem fluida
        └── ProductGallery.tsx <-- Galeria interativa com miniaturas clicáveis
```

---

### 2.1. `src/components/ui/Price.tsx`

Formatador monetário em Reais (BRL):

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

---

### 2.2. `src/components/ui/RichText.tsx`

Renderizador oficial do Lexical com suporte a estilos de tipografia do Tailwind:

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
    <div
      className={`prose prose-invert prose-emerald max-w-none text-neutral-300 [&>p]:mb-4 [&>ul]:list-disc [&>ul]:pl-5 [&>h2]:text-2xl [&>h2]:font-bold [&>h2]:text-white [&>h2]:mb-3 [&>h3]:text-xl [&>h3]:font-semibold [&>h3]:text-white [&>h3]:mb-2 ${className}`}
    >
      <PayloadRichText data={data} />
    </div>
  )
}
```

---

### 2.3. `src/components/layout/Header.tsx`

Cabeçalho moderno com efeito de vidro (*glassmorphism*), blur de fundo e links estilizados:

```tsx
import Link from 'next/link'
import React from 'react'

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-neutral-800 bg-neutral-950/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        {/* Logo */}
        <Link
          href="/"
          className="text-xl font-bold tracking-tight text-white transition-opacity hover:opacity-80"
        >
          <span className="text-emerald-400">Payload</span>Store
        </Link>

        {/* Navegação */}
        <nav className="flex items-center gap-6 text-sm font-medium">
          <Link
            href="/"
            className="text-neutral-400 transition-colors hover:text-white"
          >
            Início
          </Link>
          <Link
            href="/produtos"
            className="text-neutral-400 transition-colors hover:text-white"
          >
            Produtos
          </Link>
          <Link
            href="/admin"
            target="_blank"
            className="rounded-lg border border-neutral-700 bg-neutral-900 px-3.5 py-1.5 text-xs font-semibold text-neutral-200 transition-all hover:border-neutral-500 hover:bg-neutral-800"
          >
            Painel Admin ↗
          </Link>
        </nav>
      </div>
    </header>
  )
}
```

---

### 2.4. `src/components/layout/Footer.tsx`

Rodapé minimalista e elegante:

```tsx
import React from 'react'

export function Footer() {
  return (
    <footer className="mt-auto border-t border-neutral-800 bg-neutral-950 py-10 text-center text-sm text-neutral-500">
      <div className="mx-auto max-w-7xl px-6">
        <p>© {new Date().getFullYear()} PayloadStore. Construído com Payload CMS 3.x, Next.js e Tailwind CSS.</p>
      </div>
    </footer>
  )
}
```

---

### 2.5. `src/components/products/ProductCard.tsx`

Card de produto com animação de elevação ao passar o mouse (*hover lift*), imagem fluida e tag de preço destacada em esmeralda:

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
  const image = typeof product.image === 'object' ? (product.image as Media) : null

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/60 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-neutral-700 hover:shadow-xl hover:shadow-emerald-950/20">
      <Link href={`/produtos/${product.slug}`} className="flex flex-col flex-1">
        {/* Imagem do Produto */}
        <div className="relative aspect-square w-full overflow-hidden bg-neutral-950">
          {image?.url ? (
            <Image
              src={image.url}
              alt={image.alt || product.title}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-neutral-600">
              Sem imagem
            </div>
          )}
        </div>

        {/* Informações do Produto */}
        <div className="flex flex-1 flex-col justify-between p-5">
          <div>
            <h3 className="text-lg font-semibold tracking-tight text-white group-hover:text-emerald-400 transition-colors">
              {product.title}
            </h3>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <Price
              amount={product.price}
              className="text-xl font-bold tracking-tight text-emerald-400"
            />
            <span className="text-xs font-medium text-neutral-400 group-hover:translate-x-0.5 transition-transform">
              Ver detalhes →
            </span>
          </div>
        </div>
      </Link>
    </div>
  )
}
```

---

### 2.6. `src/components/products/ProductGallery.tsx`

Galeria interativa client-side (`'use client'`) com seleção de foto principal e miniaturas com anel de foco (*ring*):

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
  // Concatena a imagem principal com as fotos da galeria
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
    return (
      <div className="flex aspect-square w-full items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-900 text-neutral-600">
        Nenhuma foto disponível
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Imagem Principal Grande */}
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900">
        <Image
          src={currentImage.url}
          alt={currentImage.alt || title}
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-cover"
        />
      </div>

      {/* Miniaturas Clicáveis */}
      {allImages.length > 1 && (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {allImages.map((img, index) => {
            const isActive = selectedIndex === index
            return (
              <button
                key={img.id || index}
                type="button"
                onClick={() => setSelectedIndex(index)}
                className={`relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl border transition-all ${
                  isActive
                    ? 'border-emerald-500 ring-2 ring-emerald-500/30 opacity-100 scale-105'
                    : 'border-neutral-800 opacity-60 hover:opacity-100'
                }`}
              >
                <Image
                  src={img.url!}
                  alt={img.alt || `${title} thumbnail ${index + 1}`}
                  fill
                  className="object-cover"
                />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

---

## Passo 3: Criando as Páginas no Frontend (`src/app/(frontend)`)

### 3.1. Atualizando o Layout Global (`src/app/(frontend)/layout.tsx`)

Incorpore o `<Header />` e `<Footer />` no seu layout:

```tsx
import React from 'react'
import './styles.css'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'

export const metadata = {
  title: 'PayloadStore | Loja Moderna',
  description: 'Catálogo de produtos alimentado por Payload CMS e Next.js.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col antialiased selection:bg-emerald-500 selection:text-black">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  )
}
```

---

### 3.2. Catálogo de Produtos (`src/app/(frontend)/produtos/page.tsx`)

Página de listagem de produtos com grid responsivo (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`):

```tsx
import React from 'react'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Metadata } from 'next'
import { ProductCard } from '@/components/products/ProductCard'
import type { Product } from '@/payload-types'

export const metadata: Metadata = {
  title: 'Catálogo de Produtos | PayloadStore',
  description: 'Explore todos os produtos disponíveis na nossa loja.',
}

export default async function ProductsPage() {
  const payload = await getPayload({ config })

  // Busca todos os produtos publicados ordenados por data
  const { docs: products } = await payload.find({
    collection: 'products',
    where: {
      status: {
        equals: 'published',
      },
    },
    depth: 1,
    sort: '-createdAt',
  })

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      {/* Cabeçalho da Seção */}
      <div className="mb-10 flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Nossos Produtos
        </h1>
        <p className="text-neutral-400 text-base max-w-xl">
          Confira nossa seleção exclusiva com estoque atualizado em tempo real.
        </p>
      </div>

      {/* Grid de Produtos */}
      {products.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-800 p-16 text-center">
          <p className="text-lg font-medium text-neutral-300">Nenhum produto publicado no momento.</p>
          <p className="mt-1 text-sm text-neutral-500">
            Acesse o painel em <code className="text-emerald-400 font-mono">/admin</code> para cadastrar seu primeiro produto!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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

### 3.3. Página de Detalhes do Produto (`src/app/(frontend)/produtos/[slug]/page.tsx`)

Página rica em duas colunas, com galeria, botão de compra com gradiente, renderizador de RichText e metadados de SEO automáticos:

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
import Link from 'next/link'

type Props = {
  params: Promise<{ slug: string }>
}

// 1. Consulta auxiliar com profundidade para carregar todas as imagens
async function getProduct(slug: string): Promise<Product | null> {
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'products',
    where: {
      slug: { equals: slug },
      status: { equals: 'published' },
    },
    depth: 2,
    limit: 1,
  })

  return (result.docs[0] as Product) || null
}

// 2. SEO Dinâmico (OpenGraph para WhatsApp / Twitter)
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const product = await getProduct(slug)

  if (!product) return {}

  const title = product.metaTitle || `${product.title} | PayloadStore`
  const description = product.metaDescription || `Confira todos os detalhes sobre ${product.title}.`
  const imageUrl =
    typeof product.metaImage === 'object'
      ? (product.metaImage as Media)?.url
      : typeof product.image === 'object'
      ? (product.image as Media)?.url
      : undefined

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: imageUrl ? [{ url: imageUrl }] : [],
    },
  }
}

// 3. Pré-renderização Estática (SSG / ISR)
export async function generateStaticParams() {
  const payload = await getPayload({ config })
  const { docs: products } = await payload.find({
    collection: 'products',
    where: { status: { equals: 'published' } },
    limit: 100,
  })

  return products.map((p) => ({ slug: p.slug }))
}

// 4. Componente da Página
export default async function ProductDetailPage({ params }: Props) {
  const { slug } = await params
  const product = await getProduct(slug)

  if (!product) {
    notFound()
  }

  const mainImage = typeof product.image === 'object' ? (product.image as Media) : null

  // Schema.org para o Google Rich Snippet (preço nos resultados de busca)
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
    <article className="mx-auto max-w-7xl px-6 py-10">
      {/* Script estruturado para buscadores */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Migalhas de pão (Breadcrumb) */}
      <nav className="mb-8 flex items-center gap-2 text-sm text-neutral-400">
        <Link href="/" className="hover:text-white transition-colors">Início</Link>
        <span>/</span>
        <Link href="/produtos" className="hover:text-white transition-colors">Produtos</Link>
        <span>/</span>
        <span className="text-neutral-200 font-medium truncate max-w-xs">{product.title}</span>
      </nav>

      {/* Grid Principal: Galeria à esquerda, Informações à direita */}
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 items-start">
        {/* Galeria */}
        <div>
          <ProductGallery
            mainImage={mainImage}
            gallery={product.gallery}
            title={product.title}
          />
        </div>

        {/* Informações e Ações */}
        <div className="flex flex-col">
          <span className="inline-block w-fit rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/20 mb-4">
            Em Estoque
          </span>

          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {product.title}
          </h1>

          <div className="mt-4 flex items-baseline gap-3">
            <Price
              amount={product.price}
              className="text-3xl font-extrabold tracking-tight text-emerald-400"
            />
            <span className="text-xs text-neutral-400">em até 12x sem juros</span>
          </div>

          {/* Botões de Ação */}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              className="flex-1 rounded-xl bg-emerald-500 px-6 py-3.5 text-center text-sm font-bold text-neutral-950 shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-400 hover:shadow-emerald-500/30 active:scale-[0.98]"
            >
              Comprar Agora
            </button>
            <button
              type="button"
              className="flex-1 rounded-xl border border-neutral-700 bg-neutral-900 px-6 py-3.5 text-center text-sm font-semibold text-white transition-all hover:bg-neutral-800 hover:border-neutral-600 active:scale-[0.98]"
            >
              Adicionar ao Carrinho
            </button>
          </div>

          <div className="my-8 border-t border-neutral-800" />

          {/* Descrição Detalhada */}
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white mb-4">
              Descrição do Produto
            </h2>
            {product.description ? (
              <RichText data={product.description} />
            ) : (
              <p className="text-sm text-neutral-500">Nenhuma descrição informada.</p>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}
```

---

## Passo 4: SEO Dinâmico e Google Rich Snippets (Schema.org)

O código acima cuida de todo o ciclo de SEO de nível profissional:

1. **`generateMetadata`**:
   - Gera as tags `<title>` e `<meta name="description">` dinâmicas para cada produto.
   - Gera as tags **OpenGraph** (`og:image`, `og:title`, `og:description`), garantindo que compartilhamentos em redes sociais (WhatsApp, LinkedIn, Twitter/X) exibam a foto e o nome do produto com visual limpo.
2. **Schema.org (`application/ld+json`)**:
   - Informa diretamente ao robô do Google que esta página é um produto comercial (`@type: 'Product'`), com preço em Reais e disponibilidade em estoque.

---

## Passo 5: Sitemap Dinâmico Automático (`sitemap.ts`)

Crie o arquivo `src/app/sitemap.ts` para que o Next.js gere um `sitemap.xml` dinâmico em tempo real:

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
      status: { equals: 'published' },
    },
    limit: 1000,
  })

  // 2. Transforma em URLs de sitemap
  const productUrls: MetadataRoute.Sitemap = products.map((product) => ({
    url: `${siteUrl}/produtos/${product.slug}`,
    lastModified: new Date(product.updatedAt),
    changeFrequency: 'weekly',
    priority: 0.8,
  }))

  // 3. Páginas estáticas principais
  const staticUrls: MetadataRoute.Sitemap = [
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

  return [...staticUrls, ...productUrls]
}
```

> **Para testar**: Basta acessar no navegador `http://localhost:3000/sitemap.xml`.

---

## Passo 6: Checklist de Limpeza e Execução

Siga esta sequência prática para construir e testar:

### 1. Criar a Coleção
- [ ] Crie `src/collections/Products.ts`.
- [ ] Registre em `src/payload.config.ts`.
- [ ] Execute no terminal: `npm run generate:types`.

### 2. Criar os Componentes Tailwind
- [ ] Crie `src/components/ui/Price.tsx`.
- [ ] Crie `src/components/ui/RichText.tsx`.
- [ ] Crie `src/components/layout/Header.tsx` e `src/components/layout/Footer.tsx`.
- [ ] Crie `src/components/products/ProductCard.tsx` e `src/components/products/ProductGallery.tsx`.

### 3. Criar as Páginas no Frontend
- [ ] Atualize `src/app/(frontend)/layout.tsx` adicionando `<Header />` e `<Footer />`.
- [ ] Crie `src/app/(frontend)/produtos/page.tsx`.
- [ ] Crie `src/app/(frontend)/produtos/[slug]/page.tsx`.
- [ ] Crie `src/app/sitemap.ts`.

### 4. Cadastrar Produtos no Admin
- [ ] Acesse `http://localhost:3000/admin`.
- [ ] No menu **Produtos**, clique em **Criar novo**.
- [ ] Preencha:
  - **Nome**: Ex: `Teclado Mecânico Custom RGB`
  - **Slug**: Deixe vazio para autogerar ou digite `teclado-mecanico-custom-rgb`
  - **Preço**: `450.00`
  - **Status**: Selecione `Publicado`
  - **Imagem Principal**: Faça upload de uma foto legal
  - **Descrição**: Escreva um texto bacana usando títulos e parágrafos
  - Clique em **Salvar**.

### 5. Validar no Navegador
- [ ] Acesse `http://localhost:3000/produtos` para conferir o grid estilizado com Tailwind!
- [ ] Clique no produto para abrir `/produtos/teclado-mecanico-custom-rgb`.
- [ ] Acesse `http://localhost:3000/sitemap.xml` para validar o mapa do site.

---

## Dicas de Manutenção e Boas Práticas

### 💡 Por que o `styles.css` ficou tão pequeno?
Com o Tailwind v4, apenas a linha `@import "tailwindcss";` é necessária. Todas as cores, espaçamentos, fontes e layouts são controlados diretamente nas classes utilitárias dos componentes, deixando o CSS global 100% limpo.

### 💡 O Tailwind afeta o painel administrativo?
Não! O Painel Admin (`/admin`) tem seu próprio layout isolado em `src/app/(payload)/layout.tsx`. O Tailwind é importado exclusivamente dentro de `src/app/(frontend)/layout.tsx`, mantendo o painel totalmente original e sem conflitos visuais.

### 💡 Como lidar com fotos cortadas no Next/Image?
No `ProductCard.tsx`, utilizamos a classe `object-cover` junto com `aspect-square`. Isso garante que produtos com fotos em proporções diferentes sempre fiquem simétricos e alinhados na grade.
