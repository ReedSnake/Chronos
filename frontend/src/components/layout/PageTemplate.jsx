export function PageTemplate({ children, className = '' }) {
  const classes = ['page-content', className].filter(Boolean).join(' ');
  return <section className={classes}>{children}</section>;
}

export function AuthPageTemplate({ title, children }) {
  return (
    <PageTemplate className="auth-page">
      <article className="auth-card">
        <h1>{title}</h1>
        {children}
      </article>
    </PageTemplate>
  );
}
