// src/components/layout/PageWrapper.jsx
export const PageWrapper = ({ children, className = '' }) => (
  <main
    className={`mx-auto w-full px-4 pt-5 lg:px-8 lg:max-w-6xl min-h-[calc(100vh-56px)] ${className}`}
    style={{ paddingBottom: 'calc(60px + env(safe-area-inset-bottom, 8px) + 24px)' }}
  >
    {children}
  </main>
)
