import { applicationContainer } from '../app/applicationContainer';
import { ConnectionStatus } from '../components/connection/ConnectionStatus';
import { useConnectionHealth } from '../features/connection/useConnectionHealth';

export function ConnectionPage({ title }) {
  const connection = useConnectionHealth(applicationContainer.healthService);

  return (
    <section className="page-content">
      <p className="eyebrow">{title}</p>
      <ConnectionStatus connection={connection} />
    </section>
  );
}
