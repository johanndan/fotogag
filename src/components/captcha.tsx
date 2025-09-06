// /src/components/captcha.tsx
'use client'

import dynamic from 'next/dynamic';
import type { ComponentProps } from 'react';
import { FormMessage } from './ui/form';
import { useConfigStore } from '@/state/config';

const Turnstile = dynamic(
  () => import('@marsidev/react-turnstile').then(mod => mod.Turnstile),
  { ssr: false }
)

type Props = Omit<ComponentProps<typeof Turnstile>, 'siteKey'> & {
  validationError?: string
}

export const Captcha = ({ validationError, ...props }: Props) => {
  const { isTurnstileEnabled } = useConfigStore()
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ''

  if (!isTurnstileEnabled) return null

  if (!siteKey) {
    return (
      <FormMessage className="text-red-500 mt-2">
        Turnstile is enabled but site key is missing.
      </FormMessage>
    )
  }

  return (
    <>
      <Turnstile
        siteKey={siteKey}
        options={{
          size: 'flexible',
          language: 'auto',
          appearance: 'always',
          execution: 'render',
          retry: 'auto',
          retryInterval: 8000,
        }}
        onError={(err) => {
          if (process.env.NODE_ENV !== 'production') {
            console.error('Turnstile error:', err)
          }
        }}
        {...props}
      />

      {validationError && (
        <FormMessage className="text-red-500 mt-2">
          {validationError}
        </FormMessage>
      )}
    </>
  )
}
