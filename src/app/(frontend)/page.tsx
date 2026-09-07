import { headers as getHeaders } from 'next/headers.js'
import Image from 'next/image'
import { getPayload } from 'payload'
import React from 'react'
import { fileURLToPath } from 'url'

import config from '@/payload.config'
import './styles.css'

export default async function HomePage() {
  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center p-6">
      <h1 className="text-4xl font-bold tracking-tight text-emerald-400 mb-4">
        Tailwind CSS v4 Instalado com Sucesso! 🚀
      </h1>
      <p className="text-neutral-400 text-lg max-w-md text-center">
        Agora você pode estilizar seus componentes de produtos e páginas usando classes utilitárias.
      </p>
    </div>
  )
}
