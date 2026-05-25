// src/components/layout/PageWrapper.jsx
export const PageWrapper = ({ children, className = '' }) => (
  <main
    className={`mx-auto w-full px-4 pb-28 pt-5 lg:pb-8 lg:px-8 lg:max-w-6xl min-h-[calc(100vh-56px)] ${className}`}
  >
    {children}
  </main>
)
