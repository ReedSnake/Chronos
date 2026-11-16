export function ConnectionStatus({ connection }) {
  return (
    <section className="status-card" aria-live="polite">
      <span className={`indicator ${connection.state}`} />
      <h1>{connection.message}</h1>
      <p>Database: {connection.databaseStatus}</p>
    </section>
  );
}
