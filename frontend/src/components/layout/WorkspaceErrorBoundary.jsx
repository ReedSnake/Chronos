import { Component } from 'react';

export class WorkspaceErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    const { title, description, retry } = this.props;
    return (
      <section className="workspace-page-error" role="alert">
        <h1>{title}</h1>
        <p>{description}</p>
        <button type="button" onClick={() => this.setState({ failed: false })}>
          {retry}
        </button>
      </section>
    );
  }
}
