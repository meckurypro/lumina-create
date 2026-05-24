export const Input = ({ icon: Icon, error, label, className = '', ...props }) => (
  <label className="block">
    {label && <span className="mb-2 block text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>{label}</span>}
    <div className="relative">
      {Icon && <Icon size={16} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />}
      <input className={`input-base px-4 py-3.5 text-sm ${Icon ? 'pl-11' : ''} ${className}`} {...props} />
    </div>
    {error && <span className="mt-1 block text-xs" style={{ color: 'hsl(var(--destructive))' }}>{error}</span>}
  </label>
)
