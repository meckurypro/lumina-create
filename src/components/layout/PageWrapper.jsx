// src/components/layout/PageWrapper.jsx
export const PageWrapper = ({ children, className = '' }) => (
  <main
    className={`mx-auto w-full px-4 pt-5 lg:px-8 lg:max-w-6xl min-h-full ${className}`}
    style={{ paddingBottom: '24px' }}
  >
    {children}
  </main>
)
